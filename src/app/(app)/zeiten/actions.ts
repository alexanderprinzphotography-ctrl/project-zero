"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/core/supabase/server";
import { getUserContext, type UserContext } from "@/core/auth/get-user-context";
import { intervalsOverlap } from "@/core/time/entry";

export type TimeActionState = {
  error: string | null;
  warning: string | null;
  successAt: number | null;
};

const INITIAL_STATE: TimeActionState = { error: null, warning: null, successAt: null };

function readonlyErrorMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes("gesperrt") || lower.includes("row-level security");
}

function isAdminOrProjektleiter(role: string): boolean {
  return role === "admin" || role === "projektleiter";
}

export async function startTimer(
  _prevState: TimeActionState,
  formData: FormData,
): Promise<TimeActionState> {
  const context = await getUserContext();
  if (!context) return { ...INITIAL_STATE, error: "Bitte anmelden." };
  if (!context.isWritable) {
    return { ...INITIAL_STATE, error: "Testphase abgelaufen – Zeiterfassung ist gesperrt." };
  }

  const projectId = String(formData.get("projectId") ?? "");
  if (!projectId) return { ...INITIAL_STATE, error: "Bitte ein Projekt wählen." };

  const supabase = await createClient();

  // Freundliche Vorab-Meldung - die harte, race-sichere Garantie liefert der
  // Partial-Unique-Index time_entries_one_running_timer_per_user in der DB.
  const { data: running } = await supabase
    .from("time_entries")
    .select("id")
    .eq("user_id", context.userId)
    .is("ended_at", null)
    .maybeSingle();
  if (running) {
    return { ...INITIAL_STATE, error: "Es läuft bereits ein Timer. Bitte zuerst stoppen." };
  }

  const { error } = await supabase.from("time_entries").insert({
    project_id: projectId,
    started_at: new Date().toISOString(),
    entry_source: "timer",
  });

  if (error) {
    if (error.message.toLowerCase().includes("one_running_timer")) {
      return { ...INITIAL_STATE, error: "Es läuft bereits ein Timer. Bitte zuerst stoppen." };
    }
    if (readonlyErrorMessage(error.message)) {
      return { ...INITIAL_STATE, error: "Testphase abgelaufen – Zeiterfassung ist gesperrt." };
    }
    return { ...INITIAL_STATE, error: "Timer konnte nicht gestartet werden." };
  }

  revalidatePath("/zeiten");
  revalidatePath(`/projekte/${projectId}`);
  return { ...INITIAL_STATE, successAt: Date.now() };
}

export async function stopTimer(
  _prevState: TimeActionState,
  formData: FormData,
): Promise<TimeActionState> {
  const context = await getUserContext();
  if (!context) return { ...INITIAL_STATE, error: "Bitte anmelden." };

  const entryId = String(formData.get("entryId") ?? "");
  if (!entryId) return { ...INITIAL_STATE, error: "Ungültiger Eintrag." };

  const supabase = await createClient();
  const { data: entry } = await supabase
    .from("time_entries")
    .select("project_id")
    .eq("id", entryId)
    .maybeSingle();

  const { error } = await supabase
    .from("time_entries")
    .update({ ended_at: new Date().toISOString() })
    .eq("id", entryId);

  if (error) {
    if (readonlyErrorMessage(error.message)) {
      return { ...INITIAL_STATE, error: "Testphase abgelaufen – Zeiterfassung ist gesperrt." };
    }
    return { ...INITIAL_STATE, error: "Timer konnte nicht gestoppt werden." };
  }

  revalidatePath("/zeiten");
  if (entry) revalidatePath(`/projekte/${entry.project_id}`);
  return { ...INITIAL_STATE, successAt: Date.now() };
}

type ParsedManualEntry = {
  projectId: string;
  userId: string;
  startedAt: string;
  endedAt: string;
  breakMinutes: number;
  note: string | null;
};

function parseManualEntryForm(
  formData: FormData,
  context: UserContext,
): { error: string | null; input: ParsedManualEntry | null } {
  const projectId = String(formData.get("projectId") ?? "").trim();
  const requestedUserId = String(formData.get("userId") ?? "").trim();
  const startedAt = String(formData.get("startedAt") ?? "").trim();
  const endedAt = String(formData.get("endedAt") ?? "").trim();
  const breakMinutesRaw = String(formData.get("breakMinutes") ?? "0").trim();
  const note = String(formData.get("note") ?? "").trim() || null;

  if (!projectId || !startedAt || !endedAt) {
    return { error: "Bitte Projekt, Start und Ende angeben.", input: null };
  }

  const breakMinutes = Number(breakMinutesRaw || "0");
  if (!Number.isFinite(breakMinutes) || breakMinutes < 0) {
    return { error: "Ungültige Pausenzeit.", input: null };
  }

  const startedDate = new Date(startedAt);
  const endedDate = new Date(endedAt);
  if (Number.isNaN(startedDate.getTime()) || Number.isNaN(endedDate.getTime())) {
    return { error: "Ungültiges Datum/Uhrzeit.", input: null };
  }
  if (!(endedDate.getTime() > startedDate.getTime())) {
    return { error: "Ende muss nach dem Start liegen.", input: null };
  }

  const grossMinutes = (endedDate.getTime() - startedDate.getTime()) / 60000;
  if (breakMinutes > grossMinutes) {
    return { error: "Pause darf nicht länger als die Gesamtzeit sein.", input: null };
  }

  const targetUserId =
    requestedUserId && isAdminOrProjektleiter(context.role) ? requestedUserId : context.userId;

  return {
    error: null,
    input: {
      projectId,
      userId: targetUserId,
      startedAt: startedDate.toISOString(),
      endedAt: endedDate.toISOString(),
      breakMinutes,
      note,
    },
  };
}

async function findOverlap(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  startedAt: string,
  endedAt: string,
  excludeEntryId: string | null,
): Promise<boolean> {
  let query = supabase.from("time_entries").select("id, started_at, ended_at").eq("user_id", userId);
  if (excludeEntryId) {
    query = query.neq("id", excludeEntryId);
  }
  const { data: existing } = await query;
  return (existing ?? []).some((e) => intervalsOverlap(startedAt, endedAt, e.started_at, e.ended_at));
}

export async function createManualEntry(
  _prevState: TimeActionState,
  formData: FormData,
): Promise<TimeActionState> {
  const context = await getUserContext();
  if (!context) return { ...INITIAL_STATE, error: "Bitte anmelden." };
  if (!context.isWritable) {
    return { ...INITIAL_STATE, error: "Testphase abgelaufen – Zeiterfassung ist gesperrt." };
  }

  const { error: validationError, input } = parseManualEntryForm(formData, context);
  if (validationError || !input) {
    return { ...INITIAL_STATE, error: validationError };
  }

  const confirmOverlap = formData.get("confirmOverlap") === "true";
  const supabase = await createClient();

  if (!confirmOverlap) {
    const hasOverlap = await findOverlap(supabase, input.userId, input.startedAt, input.endedAt, null);
    if (hasOverlap) {
      return {
        ...INITIAL_STATE,
        warning: "Dieser Zeitraum überschneidet sich mit einem bestehenden Eintrag. Trotzdem speichern?",
      };
    }
  }

  const { error } = await supabase.from("time_entries").insert({
    project_id: input.projectId,
    user_id: input.userId,
    started_at: input.startedAt,
    ended_at: input.endedAt,
    break_minutes: input.breakMinutes,
    note: input.note,
    entry_source: "manual",
  });

  if (error) {
    if (readonlyErrorMessage(error.message)) {
      return { ...INITIAL_STATE, error: "Testphase abgelaufen – Zeiterfassung ist gesperrt." };
    }
    return { ...INITIAL_STATE, error: error.message || "Eintrag konnte nicht gespeichert werden." };
  }

  revalidatePath("/zeiten");
  revalidatePath(`/projekte/${input.projectId}`);
  return { ...INITIAL_STATE, successAt: Date.now() };
}

export async function updateTimeEntry(
  entryId: string,
  _prevState: TimeActionState,
  formData: FormData,
): Promise<TimeActionState> {
  const context = await getUserContext();
  if (!context) return { ...INITIAL_STATE, error: "Bitte anmelden." };
  if (!context.isWritable) {
    return { ...INITIAL_STATE, error: "Testphase abgelaufen – Bearbeiten ist gesperrt." };
  }

  const { error: validationError, input } = parseManualEntryForm(formData, context);
  if (validationError || !input) {
    return { ...INITIAL_STATE, error: validationError };
  }

  const confirmOverlap = formData.get("confirmOverlap") === "true";
  const supabase = await createClient();

  if (!confirmOverlap) {
    const hasOverlap = await findOverlap(
      supabase,
      input.userId,
      input.startedAt,
      input.endedAt,
      entryId,
    );
    if (hasOverlap) {
      return {
        ...INITIAL_STATE,
        warning: "Dieser Zeitraum überschneidet sich mit einem bestehenden Eintrag. Trotzdem speichern?",
      };
    }
  }

  const { error } = await supabase
    .from("time_entries")
    .update({
      project_id: input.projectId,
      user_id: input.userId,
      started_at: input.startedAt,
      ended_at: input.endedAt,
      break_minutes: input.breakMinutes,
      note: input.note,
    })
    .eq("id", entryId);

  if (error) {
    if (readonlyErrorMessage(error.message)) {
      return { ...INITIAL_STATE, error: "Testphase abgelaufen – Bearbeiten ist gesperrt." };
    }
    return { ...INITIAL_STATE, error: error.message || "Eintrag konnte nicht gespeichert werden." };
  }

  revalidatePath("/zeiten");
  revalidatePath(`/projekte/${input.projectId}`);
  return { ...INITIAL_STATE, successAt: Date.now() };
}

export async function deleteTimeEntry(
  _prevState: TimeActionState,
  formData: FormData,
): Promise<TimeActionState> {
  const context = await getUserContext();
  if (!context) return { ...INITIAL_STATE, error: "Bitte anmelden." };

  const id = String(formData.get("id") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  if (!id) return { ...INITIAL_STATE, error: "Ungültiger Eintrag." };

  const supabase = await createClient();
  const { error } = await supabase.from("time_entries").delete().eq("id", id);

  if (error) {
    if (readonlyErrorMessage(error.message)) {
      return { ...INITIAL_STATE, error: "Testphase abgelaufen – Löschen ist gesperrt." };
    }
    return { ...INITIAL_STATE, error: "Eintrag konnte nicht gelöscht werden." };
  }

  revalidatePath("/zeiten");
  if (projectId) revalidatePath(`/projekte/${projectId}`);
  return { ...INITIAL_STATE, successAt: Date.now() };
}
