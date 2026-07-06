"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/core/supabase/server";
import { getUserContext } from "@/core/auth/get-user-context";
import { PROJECT_STATUSES, type ProjectStatus } from "@/core/projects/project";
import { handwerkProjectFields } from "@/modules/handwerk/project-fields";

export type ProjectActionState = { error: string | null };

function nullableTrim(value: FormDataEntryValue | null): string | null {
  const trimmed = String(value ?? "").trim();
  return trimmed === "" ? null : trimmed;
}

function readonlyErrorMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes("row-level security") || lower.includes("gesperrt");
}

function isAdminOrProjektleiter(role: string | undefined): boolean {
  return role === "admin" || role === "projektleiter";
}

function parseMetadata(formData: FormData): Record<string, string> {
  const metadata: Record<string, string> = {};
  for (const field of handwerkProjectFields) {
    const value = String(formData.get(`field_${field.key}`) ?? "").trim();
    if (value) metadata[field.key] = value;
  }
  return metadata;
}

type ParsedProjectInput = {
  title: string;
  customer_id: string | null;
  status: ProjectStatus;
  description: string | null;
  site_street: string | null;
  site_postal_code: string | null;
  site_city: string | null;
  site_country: string;
  start_date: string | null;
  planned_end_date: string | null;
  metadata: Record<string, string>;
};

function parseAndValidate(formData: FormData): {
  error: string | null;
  input: ParsedProjectInput | null;
} {
  const title = nullableTrim(formData.get("title"));
  if (!title) {
    return { error: "Bitte einen Titel angeben.", input: null };
  }

  const statusRaw = String(formData.get("status") ?? "geplant");
  const status = (PROJECT_STATUSES as string[]).includes(statusRaw)
    ? (statusRaw as ProjectStatus)
    : "geplant";

  return {
    error: null,
    input: {
      title,
      customer_id: nullableTrim(formData.get("customerId")),
      status,
      description: nullableTrim(formData.get("description")),
      site_street: nullableTrim(formData.get("siteStreet")),
      site_postal_code: nullableTrim(formData.get("sitePostalCode")),
      site_city: nullableTrim(formData.get("siteCity")),
      site_country: nullableTrim(formData.get("siteCountry")) ?? "DE",
      start_date: nullableTrim(formData.get("startDate")),
      planned_end_date: nullableTrim(formData.get("plannedEndDate")),
      metadata: parseMetadata(formData),
    },
  };
}

export async function createProject(
  _prevState: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  const context = await getUserContext();
  if (!context || !isAdminOrProjektleiter(context.role)) {
    return { error: "Nur Admin oder Projektleiter können Projekte anlegen." };
  }
  if (!context.isWritable) {
    return { error: "Testphase abgelaufen – Anlegen ist gesperrt." };
  }

  const { error: validationError, input } = parseAndValidate(formData);
  if (validationError || !input) {
    return { error: validationError };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("projects").insert(input).select("id").single();

  if (error) {
    if (readonlyErrorMessage(error.message)) {
      return { error: "Testphase abgelaufen – Anlegen ist gesperrt." };
    }
    return { error: "Projekt konnte nicht angelegt werden." };
  }

  revalidatePath("/projekte");
  redirect(`/projekte/${data.id}`);
}

export async function updateProject(
  id: string,
  _prevState: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  const context = await getUserContext();
  if (!context || !isAdminOrProjektleiter(context.role)) {
    return { error: "Nur Admin oder Projektleiter können Projekte bearbeiten." };
  }
  if (!context.isWritable) {
    return { error: "Testphase abgelaufen – Bearbeiten ist gesperrt." };
  }

  const { error: validationError, input } = parseAndValidate(formData);
  if (validationError || !input) {
    return { error: validationError };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("projects").update(input).eq("id", id);

  if (error) {
    if (readonlyErrorMessage(error.message)) {
      return { error: "Testphase abgelaufen – Bearbeiten ist gesperrt." };
    }
    return { error: "Projekt konnte nicht gespeichert werden." };
  }

  revalidatePath("/projekte");
  revalidatePath(`/projekte/${id}`);
  redirect(`/projekte/${id}`);
}

export async function setProjectArchived(
  _prevState: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  const context = await getUserContext();
  if (!context || !isAdminOrProjektleiter(context.role)) {
    return { error: "Nur Admin oder Projektleiter können Projekte archivieren." };
  }
  if (!context.isWritable) {
    return { error: "Testphase abgelaufen – Archivieren ist gesperrt." };
  }

  const id = String(formData.get("id") ?? "");
  const archived = formData.get("archived") === "true";
  if (!id) {
    return { error: "Ungültiges Projekt." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("projects").update({ is_archived: archived }).eq("id", id);

  if (error) {
    if (readonlyErrorMessage(error.message)) {
      return { error: "Testphase abgelaufen – Archivieren ist gesperrt." };
    }
    return { error: "Aktion fehlgeschlagen." };
  }

  revalidatePath("/projekte");
  revalidatePath(`/projekte/${id}`);
  return { error: null };
}

export async function updateProjectStatus(
  _prevState: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  const context = await getUserContext();
  if (!context || !isAdminOrProjektleiter(context.role)) {
    return { error: "Nur Admin oder Projektleiter können den Status ändern." };
  }
  if (!context.isWritable) {
    return { error: "Testphase abgelaufen – Statuswechsel ist gesperrt." };
  }

  const id = String(formData.get("id") ?? "");
  const statusRaw = String(formData.get("status") ?? "");
  if (!id || !(PROJECT_STATUSES as string[]).includes(statusRaw)) {
    return { error: "Ungültiger Status." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("projects").update({ status: statusRaw }).eq("id", id);

  if (error) {
    if (readonlyErrorMessage(error.message)) {
      return { error: "Testphase abgelaufen – Statuswechsel ist gesperrt." };
    }
    return { error: "Status konnte nicht geändert werden." };
  }

  revalidatePath(`/projekte/${id}`);
  return { error: null };
}

export async function addProjectMember(
  _prevState: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  const context = await getUserContext();
  if (!context || !isAdminOrProjektleiter(context.role)) {
    return { error: "Nur Admin oder Projektleiter können Mitglieder zuweisen." };
  }
  if (!context.isWritable) {
    return { error: "Testphase abgelaufen – Zuweisen ist gesperrt." };
  }

  const projectId = String(formData.get("projectId") ?? "");
  const userId = String(formData.get("userId") ?? "");
  if (!projectId || !userId) {
    return { error: "Bitte eine Person auswählen." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("project_members")
    .insert({ project_id: projectId, user_id: userId });

  if (error) {
    if (readonlyErrorMessage(error.message)) {
      return { error: "Testphase abgelaufen – Zuweisen ist gesperrt." };
    }
    if (error.message.toLowerCase().includes("duplicate")) {
      return { error: "Person ist bereits zugewiesen." };
    }
    return { error: "Zuweisen fehlgeschlagen." };
  }

  revalidatePath(`/projekte/${projectId}`);
  return { error: null };
}

export async function removeProjectMember(
  _prevState: ProjectActionState,
  formData: FormData,
): Promise<ProjectActionState> {
  const context = await getUserContext();
  if (!context || !isAdminOrProjektleiter(context.role)) {
    return { error: "Nur Admin oder Projektleiter können Mitglieder entfernen." };
  }
  if (!context.isWritable) {
    return { error: "Testphase abgelaufen – Entfernen ist gesperrt." };
  }

  const memberId = String(formData.get("memberId") ?? "");
  const projectId = String(formData.get("projectId") ?? "");
  if (!memberId) {
    return { error: "Ungültige Zuweisung." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("project_members").delete().eq("id", memberId);

  if (error) {
    if (readonlyErrorMessage(error.message)) {
      return { error: "Testphase abgelaufen – Entfernen ist gesperrt." };
    }
    return { error: "Entfernen fehlgeschlagen." };
  }

  revalidatePath(`/projekte/${projectId}`);
  return { error: null };
}
