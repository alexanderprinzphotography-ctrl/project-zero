"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/core/supabase/server";
import { getUserContext } from "@/core/auth/get-user-context";
import {
  absenceKindLabel,
  intervalsOverlap,
  type AbsenceKind,
  type HalfDaySlot,
  type ScheduleEntryType,
  type ScheduleMode,
} from "@/core/schedule/entry";

export type ScheduleActionState = {
  error: string | null;
  warning: string | null;
  blocked: string | null;
  // Echo zurueck an den Client: wurde bei DIESEM Aufruf ein Abwesenheits-Override
  // bestaetigt? Der Client haelt das dann "sticky" (siehe ScheduleEntryForm),
  // damit ein spaeter zusaetzlich auftretender Doppelbelegungs-Hinweis den
  // bereits bestaetigten Override nicht wieder verwirft.
  absenceOverridden: boolean;
  successAt: number | null;
};

const INITIAL_STATE: ScheduleActionState = {
  error: null,
  warning: null,
  blocked: null,
  absenceOverridden: false,
  successAt: null,
};

function readonlyErrorMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes("gesperrt") || lower.includes("row-level security");
}

function isAdminOrProjektleiter(role: string): boolean {
  return role === "admin" || role === "projektleiter";
}

type ParsedScheduleEntry = {
  userId: string;
  type: ScheduleEntryType;
  projectId: string | null;
  absenceKind: AbsenceKind | null;
  mode: ScheduleMode;
  halfDaySlot: HalfDaySlot | null;
  startsAt: string;
  endsAt: string;
  note: string | null;
};

function parseScheduleEntryForm(formData: FormData): {
  error: string | null;
  input: ParsedScheduleEntry | null;
} {
  const userId = String(formData.get("userId") ?? "").trim();
  const type = String(formData.get("type") ?? "").trim();
  const mode = String(formData.get("mode") ?? "").trim();
  const startsAt = String(formData.get("startsAt") ?? "").trim();
  const endsAt = String(formData.get("endsAt") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim() || null;

  if (!userId) return { error: "Bitte einen Mitarbeiter wählen.", input: null };
  if (type !== "einsatz" && type !== "abwesenheit") {
    return { error: "Ungültiger Typ.", input: null };
  }
  if (mode !== "ganztags" && mode !== "halbtags" && mode !== "uhrzeit") {
    return { error: "Ungültiger Modus.", input: null };
  }
  if (!startsAt || !endsAt) return { error: "Bitte einen Zeitraum angeben.", input: null };

  const startsDate = new Date(startsAt);
  const endsDate = new Date(endsAt);
  if (Number.isNaN(startsDate.getTime()) || Number.isNaN(endsDate.getTime())) {
    return { error: "Ungültiges Datum/Uhrzeit.", input: null };
  }
  if (!(endsDate.getTime() > startsDate.getTime())) {
    return { error: "Ende muss nach dem Start liegen.", input: null };
  }

  let projectId: string | null = null;
  let absenceKind: AbsenceKind | null = null;

  if (type === "einsatz") {
    projectId = String(formData.get("projectId") ?? "").trim() || null;
    if (!projectId) return { error: "Bitte ein Projekt wählen.", input: null };
  } else {
    const rawAbsenceKind = String(formData.get("absenceKind") ?? "").trim();
    if (!["urlaub", "krank", "sonstiges"].includes(rawAbsenceKind)) {
      return { error: "Bitte eine Abwesenheitsart wählen.", input: null };
    }
    absenceKind = rawAbsenceKind as AbsenceKind;
  }

  let halfDaySlot: HalfDaySlot | null = null;
  if (mode === "halbtags") {
    const rawSlot = String(formData.get("halfDaySlot") ?? "").trim();
    if (rawSlot !== "vormittag" && rawSlot !== "nachmittag") {
      return { error: "Bitte Vormittag oder Nachmittag wählen.", input: null };
    }
    halfDaySlot = rawSlot;
  }

  return {
    error: null,
    input: {
      userId,
      type: type as ScheduleEntryType,
      projectId,
      absenceKind,
      mode: mode as ScheduleMode,
      halfDaySlot,
      startsAt: startsDate.toISOString(),
      endsAt: endsDate.toISOString(),
      note,
    },
  };
}

type ConflictRow = {
  id: string;
  type: ScheduleEntryType;
  absence_kind: AbsenceKind | null;
  starts_at: string;
  ends_at: string;
  projects: { title: string } | null;
};

async function findConflicts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  startsAt: string,
  endsAt: string,
  excludeEntryId: string | null,
): Promise<{ absenceConflict: ConflictRow | null; einsatzConflict: ConflictRow | null }> {
  let query = supabase
    .from("schedule_entries")
    .select("id, type, absence_kind, starts_at, ends_at, projects(title)")
    .eq("user_id", userId);
  if (excludeEntryId) {
    query = query.neq("id", excludeEntryId);
  }
  const { data } = await query;
  const rows = (data as unknown as ConflictRow[] | null) ?? [];
  const overlapping = rows.filter((e) => intervalsOverlap(startsAt, endsAt, e.starts_at, e.ends_at));
  const absenceConflict = overlapping.find((e) => e.type === "abwesenheit") ?? null;
  const einsatzConflict = overlapping.find((e) => e.type === "einsatz") ?? null;
  return { absenceConflict, einsatzConflict };
}

export async function createScheduleEntry(
  _prevState: ScheduleActionState,
  formData: FormData,
): Promise<ScheduleActionState> {
  const context = await getUserContext();
  if (!context) return { ...INITIAL_STATE, error: "Bitte anmelden." };
  if (!isAdminOrProjektleiter(context.role)) {
    return { ...INITIAL_STATE, error: "Keine Berechtigung für die Einsatzplanung." };
  }
  if (!context.isWritable) {
    return { ...INITIAL_STATE, error: "Testphase abgelaufen – Planung ist gesperrt." };
  }

  const { error: validationError, input } = parseScheduleEntryForm(formData);
  if (validationError || !input) {
    return { ...INITIAL_STATE, error: validationError };
  }

  const confirmOverlap = formData.get("confirmOverlap") === "true";
  const confirmAbsenceOverride = formData.get("confirmAbsenceOverride") === "true";
  const supabase = await createClient();

  const { absenceConflict, einsatzConflict } = await findConflicts(
    supabase,
    input.userId,
    input.startsAt,
    input.endsAt,
    null,
  );

  if (absenceConflict && !confirmAbsenceOverride) {
    return {
      ...INITIAL_STATE,
      blocked: `Mitarbeiter ist abwesend (${absenceKindLabel(absenceConflict.absence_kind ?? "sonstiges")}). Trotzdem einplanen?`,
    };
  }

  if (einsatzConflict && !confirmOverlap) {
    return {
      ...INITIAL_STATE,
      absenceOverridden: confirmAbsenceOverride,
      warning: `Doppelbelegung: bereits auf Baustelle „${einsatzConflict.projects?.title ?? "unbekannt"}“ eingeplant. Trotzdem speichern?`,
    };
  }

  const { error } = await supabase.from("schedule_entries").insert({
    user_id: input.userId,
    type: input.type,
    project_id: input.projectId,
    absence_kind: input.absenceKind,
    mode: input.mode,
    half_day_slot: input.halfDaySlot,
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    note: input.note,
  });

  if (error) {
    if (readonlyErrorMessage(error.message)) {
      return { ...INITIAL_STATE, error: "Testphase abgelaufen – Planung ist gesperrt." };
    }
    return { ...INITIAL_STATE, error: error.message || "Eintrag konnte nicht gespeichert werden." };
  }

  revalidatePath("/einsatzplanung");
  return { ...INITIAL_STATE, successAt: Date.now() };
}

export async function updateScheduleEntry(
  entryId: string,
  _prevState: ScheduleActionState,
  formData: FormData,
): Promise<ScheduleActionState> {
  const context = await getUserContext();
  if (!context) return { ...INITIAL_STATE, error: "Bitte anmelden." };
  if (!isAdminOrProjektleiter(context.role)) {
    return { ...INITIAL_STATE, error: "Keine Berechtigung für die Einsatzplanung." };
  }
  if (!context.isWritable) {
    return { ...INITIAL_STATE, error: "Testphase abgelaufen – Bearbeiten ist gesperrt." };
  }

  const { error: validationError, input } = parseScheduleEntryForm(formData);
  if (validationError || !input) {
    return { ...INITIAL_STATE, error: validationError };
  }

  const confirmOverlap = formData.get("confirmOverlap") === "true";
  const confirmAbsenceOverride = formData.get("confirmAbsenceOverride") === "true";
  const supabase = await createClient();

  const { absenceConflict, einsatzConflict } = await findConflicts(
    supabase,
    input.userId,
    input.startsAt,
    input.endsAt,
    entryId,
  );

  if (absenceConflict && !confirmAbsenceOverride) {
    return {
      ...INITIAL_STATE,
      blocked: `Mitarbeiter ist abwesend (${absenceKindLabel(absenceConflict.absence_kind ?? "sonstiges")}). Trotzdem einplanen?`,
    };
  }

  if (einsatzConflict && !confirmOverlap) {
    return {
      ...INITIAL_STATE,
      absenceOverridden: confirmAbsenceOverride,
      warning: `Doppelbelegung: bereits auf Baustelle „${einsatzConflict.projects?.title ?? "unbekannt"}“ eingeplant. Trotzdem speichern?`,
    };
  }

  const { error } = await supabase
    .from("schedule_entries")
    .update({
      user_id: input.userId,
      type: input.type,
      project_id: input.projectId,
      absence_kind: input.absenceKind,
      mode: input.mode,
      half_day_slot: input.halfDaySlot,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      note: input.note,
    })
    .eq("id", entryId);

  if (error) {
    if (readonlyErrorMessage(error.message)) {
      return { ...INITIAL_STATE, error: "Testphase abgelaufen – Bearbeiten ist gesperrt." };
    }
    return { ...INITIAL_STATE, error: error.message || "Eintrag konnte nicht gespeichert werden." };
  }

  revalidatePath("/einsatzplanung");
  return { ...INITIAL_STATE, successAt: Date.now() };
}

export async function deleteScheduleEntry(
  _prevState: ScheduleActionState,
  formData: FormData,
): Promise<ScheduleActionState> {
  const context = await getUserContext();
  if (!context) return { ...INITIAL_STATE, error: "Bitte anmelden." };
  if (!isAdminOrProjektleiter(context.role)) {
    return { ...INITIAL_STATE, error: "Keine Berechtigung für die Einsatzplanung." };
  }

  const id = String(formData.get("id") ?? "");
  if (!id) return { ...INITIAL_STATE, error: "Ungültiger Eintrag." };

  const supabase = await createClient();
  const { error } = await supabase.from("schedule_entries").delete().eq("id", id);

  if (error) {
    if (readonlyErrorMessage(error.message)) {
      return { ...INITIAL_STATE, error: "Testphase abgelaufen – Löschen ist gesperrt." };
    }
    return { ...INITIAL_STATE, error: "Eintrag konnte nicht gelöscht werden." };
  }

  revalidatePath("/einsatzplanung");
  return { ...INITIAL_STATE, successAt: Date.now() };
}
