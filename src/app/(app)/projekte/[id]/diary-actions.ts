"use server";

import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/core/supabase/server";
import { getUserContext } from "@/core/auth/get-user-context";
import type { DiaryCategory } from "@/core/diary/entry";

export type DiaryActionState = { error: string | null; successAt: number | null };

export type VerifyResult = { valid: boolean; brokenAtSeq: number | null; message: string };

const ALLOWED_PHOTO_TYPES = ["image/png", "image/jpeg", "image/webp", "image/heic"];
const MAX_PHOTO_SIZE = 10 * 1024 * 1024; // deckt sich mit dem Bucket-Limit aus MS 5a

function extensionForMimeType(type: string): string {
  switch (type) {
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    case "image/webp":
      return "webp";
    case "image/heic":
      return "heic";
    default:
      return "jpg";
  }
}

function readonlyErrorMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes("gesperrt") || lower.includes("row-level security");
}

function nullableTrim(value: FormDataEntryValue | null): string | null {
  const trimmed = String(value ?? "").trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Legt einen Tagebuch-Eintrag an: Fotos zuerst hochladen und hashen, dann den
 * Eintrag ATOMAR ueber append_diary_entry() anhaengen (siehe MS 5a) - an der
 * Hash-Kette/den Policies selbst aendert dieser Code nichts, er nutzt sie nur.
 */
export async function createDiaryEntry(
  projectId: string,
  _prevState: DiaryActionState,
  formData: FormData,
): Promise<DiaryActionState> {
  const context = await getUserContext();
  if (!context) {
    return { error: "Bitte anmelden.", successAt: null };
  }
  if (!context.isWritable) {
    return { error: "Testphase abgelaufen – Tagebuch-Einträge sind gesperrt.", successAt: null };
  }

  const text = String(formData.get("text") ?? "").trim();
  const categoryRaw = String(formData.get("category") ?? "");
  const category = categoryRaw ? (categoryRaw as DiaryCategory) : null;
  const correctsEntryId = nullableTrim(formData.get("correctsEntryId"));

  const files = formData
    .getAll("photos")
    .filter((f): f is File => f instanceof File && f.size > 0);

  if (!text && files.length === 0) {
    return { error: "Bitte Text oder mindestens ein Foto angeben.", successAt: null };
  }

  for (const file of files) {
    if (!ALLOWED_PHOTO_TYPES.includes(file.type)) {
      return { error: `Dateityp nicht erlaubt: ${file.type || "unbekannt"}`, successAt: null };
    }
    if (file.size > MAX_PHOTO_SIZE) {
      return { error: "Ein Foto ist zu groß (max. 10 MB).", successAt: null };
    }
  }

  const supabase = await createClient();
  const photos: { storage_path: string; file_hash: string }[] = [];

  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const fileHash = createHash("sha256").update(buffer).digest("hex");
    const path = `${projectId}/${randomUUID()}.${extensionForMimeType(file.type)}`;

    const { error: uploadError } = await supabase.storage
      .from("diary-photos")
      .upload(path, buffer, { contentType: file.type });

    if (uploadError) {
      if (readonlyErrorMessage(uploadError.message)) {
        return {
          error: "Testphase abgelaufen – Tagebuch-Einträge sind gesperrt.",
          successAt: null,
        };
      }
      return { error: "Foto konnte nicht hochgeladen werden.", successAt: null };
    }

    photos.push({ storage_path: path, file_hash: fileHash });
  }

  const { error: rpcError } = await supabase.rpc("append_diary_entry", {
    p_project_id: projectId,
    p_text: text || null,
    p_category: category,
    p_corrects_entry_id: correctsEntryId,
    p_photos: photos,
  });

  if (rpcError) {
    if (readonlyErrorMessage(rpcError.message)) {
      return { error: "Testphase abgelaufen – Tagebuch-Einträge sind gesperrt.", successAt: null };
    }
    return { error: rpcError.message || "Eintrag konnte nicht angelegt werden.", successAt: null };
  }

  revalidatePath(`/projekte/${projectId}`);
  return { error: null, successAt: Date.now() };
}

/**
 * Ruft verify_diary() auf (siehe MS 5a) und liefert das Ergebnis fuer die UI.
 */
export async function verifyDiaryChain(projectId: string): Promise<VerifyResult> {
  const context = await getUserContext();
  if (!context || !["admin", "projektleiter"].includes(context.role)) {
    return { valid: false, brokenAtSeq: null, message: "Keine Berechtigung." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("verify_diary", { p_project_id: projectId });

  if (error || !data || data.length === 0) {
    return {
      valid: false,
      brokenAtSeq: null,
      message: error?.message ?? "Verifikation fehlgeschlagen.",
    };
  }

  const result = data[0] as { valid: boolean; broken_at_seq: number | null; message: string };
  return { valid: result.valid, brokenAtSeq: result.broken_at_seq, message: result.message };
}
