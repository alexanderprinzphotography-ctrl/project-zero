"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/core/supabase/server";
import { getUserContext } from "@/core/auth/get-user-context";
import { computeLineTotalNetCents, hundredthsToDecimalString } from "@/core/money/quote-math";
import { recalculateQuoteTotals } from "@/core/quotes/recalculate";
import { requestAiQuoteDraft, type AiDraftRoom } from "@/core/quotes/ai-draft";
import { validateAiMatches } from "@/core/quotes/ai-validation";

export type AiDraftActionState = { error: string | null };

function isAdminOrProjektleiter(role: string): boolean {
  return role === "admin" || role === "projektleiter";
}

function readonlyErrorMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes("row-level security") || lower.includes("gesperrt");
}

function parseGermanDecimal(value: string): number | null {
  const trimmed = value.trim().replace(",", ".");
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

type RoomFormEntry = { name?: string; length?: string; width?: string; height?: string; count?: string };

/** Flaeche wird HIER im Code berechnet (Laenge x Breite), nie von der KI. */
function parseRooms(formData: FormData): AiDraftRoom[] {
  const raw = String(formData.get("roomsJson") ?? "[]");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const rooms: AiDraftRoom[] = [];
  for (const entry of parsed as RoomFormEntry[]) {
    if (typeof entry !== "object" || entry === null) continue;
    const name = String(entry.name ?? "").trim();
    const length = parseGermanDecimal(String(entry.length ?? ""));
    const width = parseGermanDecimal(String(entry.width ?? ""));
    const height = parseGermanDecimal(String(entry.height ?? ""));
    const count = parseGermanDecimal(String(entry.count ?? "1")) ?? 1;
    if (length === null || width === null) continue;
    const areaM2 = Math.round(length * width * 100) / 100;
    rooms.push({ name: name || "Raum", length, width, height: height ?? 0, count, areaM2 });
  }
  return rooms;
}

export async function createAiQuoteDraft(
  _prevState: AiDraftActionState,
  formData: FormData,
): Promise<AiDraftActionState> {
  const context = await getUserContext();
  if (!context || !isAdminOrProjektleiter(context.role)) {
    return { error: "Nur Admin oder Projektleiter können einen KI-Entwurf erstellen." };
  }
  if (!context.isWritable) {
    return { error: "Testphase abgelaufen – KI-Entwurf ist gesperrt." };
  }

  const customerId = String(formData.get("customerId") ?? "").trim();
  const projectId = String(formData.get("projectId") ?? "").trim() || null;
  const description = String(formData.get("description") ?? "").trim();

  if (!customerId) return { error: "Bitte einen Kunden wählen." };
  if (!description) return { error: "Bitte eine Beschreibung der Arbeiten angeben." };

  const rooms = parseRooms(formData);

  const supabase = await createClient();
  const { data: catalogRows } = await supabase
    .from("catalog_items")
    .select("id, name, unit, unit_price_net_cents")
    .eq("is_active", true);
  const catalogItems = catalogRows ?? [];

  if (catalogItems.length === 0) {
    return { error: "Kein aktiver Leistungskatalog vorhanden – bitte zuerst Positionen anlegen." };
  }

  let draft;
  try {
    draft = await requestAiQuoteDraft({
      description,
      rooms,
      catalog: catalogItems.map((c) => ({ id: c.id, name: c.name, unit: c.unit })),
    });
  } catch (err) {
    console.error("KI-Angebotsentwurf fehlgeschlagen:", err);
    return { error: "KI-Entwurf konnte nicht erstellt werden. Bitte später erneut versuchen." };
  }

  // Sicherheitsschicht gegen Halluzination: jede von der KI zurueckgegebene
  // catalog_item_id gegen den ECHTEN, gerade frisch geladenen Firmen-Katalog
  // pruefen (siehe core/quotes/ai-validation.ts) - nicht existierende IDs
  // werden verworfen, nie uebernommen.
  const validMatches = validateAiMatches(draft.matched, catalogItems);

  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .insert({
      customer_id: customerId,
      project_id: projectId,
      is_ai_generated: true,
      intake_description: description,
      intake_rooms: rooms,
      unmatched_items: draft.unmatched,
      intro_text: draft.introText,
      closing_text: draft.closingText,
    })
    .select("id")
    .single();

  if (quoteError || !quote) {
    if (quoteError && readonlyErrorMessage(quoteError.message)) {
      return { error: "Testphase abgelaufen – KI-Entwurf ist gesperrt." };
    }
    return { error: "Angebot konnte nicht angelegt werden." };
  }

  if (validMatches.length > 0) {
    const itemsToInsert = validMatches.map((m, index) => ({
      quote_id: quote.id,
      catalog_item_id: m.catalogItemId,
      position: index + 1,
      name: m.name,
      unit: m.unit,
      quantity: hundredthsToDecimalString(m.quantityHundredths),
      unit_price_net_cents: m.unitPriceNetCents,
      line_total_net_cents: computeLineTotalNetCents(m.quantityHundredths, m.unitPriceNetCents),
      is_ai_suggested: true,
      ai_note: m.aiNote,
    }));
    await supabase.from("quote_items").insert(itemsToInsert);
    await recalculateQuoteTotals(supabase, quote.id);
  }

  redirect(`/angebote/${quote.id}`);
}
