"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/core/supabase/server";
import { getUserContext } from "@/core/auth/get-user-context";

export type ThemeActionState = { error: string | null; success: boolean };

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const ALLOWED_LOGO_TYPES = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];
const MAX_LOGO_SIZE = 2 * 1024 * 1024;

function extensionForMimeType(type: string): string {
  switch (type) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/svg+xml":
      return "svg";
    case "image/webp":
      return "webp";
    default:
      return "png";
  }
}

function readonlyErrorMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes("nur-lese") || lower.includes("gesperrt") || lower.includes("row-level security");
}

export async function updateThemeColors(
  _prevState: ThemeActionState,
  formData: FormData,
): Promise<ThemeActionState> {
  const context = await getUserContext();
  if (!context || context.role !== "admin") {
    return { error: "Nur Admins können das Theme ändern.", success: false };
  }
  if (!context.isWritable) {
    return {
      error: "Testphase abgelaufen – Theme-Änderungen sind gesperrt.",
      success: false,
    };
  }

  const primaryColor = String(formData.get("primaryColor") ?? "").trim();
  const accentColor = String(formData.get("accentColor") ?? "").trim();

  if (!HEX_RE.test(primaryColor) || !HEX_RE.test(accentColor)) {
    return { error: "Bitte gültige Hex-Farbwerte angeben (z. B. #1d4ed8).", success: false };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("companies")
    .update({ primary_color: primaryColor, accent_color: accentColor })
    .eq("id", context.companyId);

  if (error) {
    if (readonlyErrorMessage(error.message)) {
      return {
        error: "Testphase abgelaufen – Theme-Änderungen sind gesperrt.",
        success: false,
      };
    }
    return { error: "Farben konnten nicht gespeichert werden.", success: false };
  }

  revalidatePath("/", "layout");
  return { error: null, success: true };
}

export async function updateProjectVisibility(
  _prevState: ThemeActionState,
  formData: FormData,
): Promise<ThemeActionState> {
  const context = await getUserContext();
  if (!context || context.role !== "admin") {
    return { error: "Nur Admins können die Projekt-Sichtbarkeit ändern.", success: false };
  }
  if (!context.isWritable) {
    return {
      error: "Testphase abgelaufen – Einstellungen sind gesperrt.",
      success: false,
    };
  }

  const visibility = String(formData.get("projectVisibility") ?? "");
  if (!["all", "assigned"].includes(visibility)) {
    return { error: "Ungültige Auswahl.", success: false };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("companies")
    .update({ project_visibility: visibility })
    .eq("id", context.companyId);

  if (error) {
    if (readonlyErrorMessage(error.message)) {
      return {
        error: "Testphase abgelaufen – Einstellungen sind gesperrt.",
        success: false,
      };
    }
    return { error: "Einstellung konnte nicht gespeichert werden.", success: false };
  }

  revalidatePath("/", "layout");
  revalidatePath("/projekte");
  return { error: null, success: true };
}

export async function updateScheduleVisibility(
  _prevState: ThemeActionState,
  formData: FormData,
): Promise<ThemeActionState> {
  const context = await getUserContext();
  if (!context || context.role !== "admin") {
    return { error: "Nur Admins können die Planungs-Sichtbarkeit ändern.", success: false };
  }
  if (!context.isWritable) {
    return {
      error: "Testphase abgelaufen – Einstellungen sind gesperrt.",
      success: false,
    };
  }

  const visibility = String(formData.get("scheduleVisibility") ?? "");
  if (!["own", "team"].includes(visibility)) {
    return { error: "Ungültige Auswahl.", success: false };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("companies")
    .update({ schedule_visibility: visibility })
    .eq("id", context.companyId);

  if (error) {
    if (readonlyErrorMessage(error.message)) {
      return {
        error: "Testphase abgelaufen – Einstellungen sind gesperrt.",
        success: false,
      };
    }
    return { error: "Einstellung konnte nicht gespeichert werden.", success: false };
  }

  revalidatePath("/", "layout");
  revalidatePath("/einsatzplanung");
  return { error: null, success: true };
}

export async function uploadLogo(
  _prevState: ThemeActionState,
  formData: FormData,
): Promise<ThemeActionState> {
  const context = await getUserContext();
  if (!context || context.role !== "admin") {
    return { error: "Nur Admins können das Logo ändern.", success: false };
  }
  if (!context.isWritable) {
    return {
      error: "Testphase abgelaufen – Theme-Änderungen sind gesperrt.",
      success: false,
    };
  }

  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Bitte eine Datei auswählen.", success: false };
  }
  if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
    return { error: "Nur PNG, JPG, SVG oder WEBP erlaubt.", success: false };
  }
  if (file.size > MAX_LOGO_SIZE) {
    return { error: "Datei darf maximal 2 MB groß sein.", success: false };
  }

  const supabase = await createClient();
  const companyId = context.companyId;

  const { data: existing } = await supabase.storage.from("logos").list(companyId);
  if (existing && existing.length > 0) {
    await supabase.storage.from("logos").remove(existing.map((f) => `${companyId}/${f.name}`));
  }

  const path = `${companyId}/logo.${extensionForMimeType(file.type)}`;
  const { error: uploadError } = await supabase.storage.from("logos").upload(path, file, {
    upsert: true,
    contentType: file.type,
  });

  if (uploadError) {
    if (readonlyErrorMessage(uploadError.message)) {
      return {
        error: "Testphase abgelaufen – Theme-Änderungen sind gesperrt.",
        success: false,
      };
    }
    return { error: "Logo konnte nicht hochgeladen werden.", success: false };
  }

  const { data: publicUrlData } = supabase.storage.from("logos").getPublicUrl(path);
  // Cache-Busting: verhindert, dass Browser/CDN das alte Logo unter derselben URL zeigen.
  const logoUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`;

  const { error: updateError } = await supabase
    .from("companies")
    .update({ logo_url: logoUrl })
    .eq("id", companyId);

  if (updateError) {
    return { error: "Logo hochgeladen, aber Speichern fehlgeschlagen.", success: false };
  }

  revalidatePath("/", "layout");
  return { error: null, success: true };
}
