"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/core/supabase/server";
import { getUserContext } from "@/core/auth/get-user-context";
import { parseEuroInputToCents } from "@/core/money/cents";
import {
  computeLineTotalNetCents,
  hundredthsToDecimalString,
  parseQuantityToHundredths,
} from "@/core/money/quote-math";
import { EDITABLE_QUOTE_STATUSES, quoteStatusLabel } from "@/core/quotes/quote";
import { recalculateQuoteTotals } from "@/core/quotes/recalculate";

export type QuoteItemActionState = { error: string | null; successAt: number | null };

const INITIAL_STATE: QuoteItemActionState = { error: null, successAt: null };

function isAdminOrProjektleiter(role: string): boolean {
  return role === "admin" || role === "projektleiter";
}

function readonlyErrorMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes("row-level security") || lower.includes("gesperrt");
}

async function checkQuoteEditable(
  supabase: Awaited<ReturnType<typeof createClient>>,
  quoteId: string,
): Promise<string | null> {
  const { data: quote } = await supabase.from("quotes").select("status").eq("id", quoteId).maybeSingle();
  if (!quote) return "Angebot nicht gefunden.";
  if (!EDITABLE_QUOTE_STATUSES.includes(quote.status)) {
    return `Angebot im Status „${quoteStatusLabel(quote.status)}“ kann nicht mehr bearbeitet werden.`;
  }
  return null;
}

type ParsedItemInput = {
  name: string;
  unit: string;
  quantity: string;
  unit_price_net_cents: number;
  line_total_net_cents: number;
};

function parseItemForm(formData: FormData): { error: string | null; input: ParsedItemInput | null } {
  const name = String(formData.get("name") ?? "").trim();
  const unit = String(formData.get("unit") ?? "").trim();
  const quantityInput = String(formData.get("quantity") ?? "").trim();
  const priceInput = String(formData.get("unitPriceEuro") ?? "").trim();

  if (!name) return { error: "Bitte eine Bezeichnung angeben.", input: null };
  if (!unit) return { error: "Bitte eine Einheit angeben.", input: null };

  const quantityHundredths = parseQuantityToHundredths(quantityInput);
  if (quantityHundredths === null || quantityHundredths <= 0) {
    return { error: "Bitte eine gültige Menge angeben (z. B. 12,5).", input: null };
  }

  const unitPriceNetCents = parseEuroInputToCents(priceInput);
  if (unitPriceNetCents === null) {
    return { error: "Bitte einen gültigen Preis angeben (z. B. 19,99).", input: null };
  }

  return {
    error: null,
    input: {
      name,
      unit,
      quantity: hundredthsToDecimalString(quantityHundredths),
      unit_price_net_cents: unitPriceNetCents,
      line_total_net_cents: computeLineTotalNetCents(quantityHundredths, unitPriceNetCents),
    },
  };
}

export async function addQuoteItem(
  _prevState: QuoteItemActionState,
  formData: FormData,
): Promise<QuoteItemActionState> {
  const context = await getUserContext();
  if (!context || !isAdminOrProjektleiter(context.role)) {
    return { ...INITIAL_STATE, error: "Nur Admin oder Projektleiter können Positionen hinzufügen." };
  }
  if (!context.isWritable) {
    return { ...INITIAL_STATE, error: "Testphase abgelaufen – Bearbeiten ist gesperrt." };
  }

  const quoteId = String(formData.get("quoteId") ?? "");
  if (!quoteId) return { ...INITIAL_STATE, error: "Ungültiges Angebot." };

  const supabase = await createClient();
  const statusError = await checkQuoteEditable(supabase, quoteId);
  if (statusError) return { ...INITIAL_STATE, error: statusError };

  const { error: validationError, input } = parseItemForm(formData);
  if (validationError || !input) return { ...INITIAL_STATE, error: validationError };

  const catalogItemId = String(formData.get("catalogItemId") ?? "").trim() || null;

  const { data: maxPositionRow } = await supabase
    .from("quote_items")
    .select("position")
    .eq("quote_id", quoteId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextPosition = (maxPositionRow?.position ?? 0) + 1;

  const { error } = await supabase.from("quote_items").insert({
    quote_id: quoteId,
    catalog_item_id: catalogItemId,
    position: nextPosition,
    ...input,
  });

  if (error) {
    if (readonlyErrorMessage(error.message)) {
      return { ...INITIAL_STATE, error: "Testphase abgelaufen – Bearbeiten ist gesperrt." };
    }
    return { ...INITIAL_STATE, error: "Position konnte nicht hinzugefügt werden." };
  }

  await recalculateQuoteTotals(supabase, quoteId);

  revalidatePath(`/angebote/${quoteId}`);
  return { ...INITIAL_STATE, successAt: Date.now() };
}

export async function updateQuoteItem(
  itemId: string,
  _prevState: QuoteItemActionState,
  formData: FormData,
): Promise<QuoteItemActionState> {
  const context = await getUserContext();
  if (!context || !isAdminOrProjektleiter(context.role)) {
    return { ...INITIAL_STATE, error: "Nur Admin oder Projektleiter können Positionen bearbeiten." };
  }
  if (!context.isWritable) {
    return { ...INITIAL_STATE, error: "Testphase abgelaufen – Bearbeiten ist gesperrt." };
  }

  const quoteId = String(formData.get("quoteId") ?? "");
  if (!quoteId) return { ...INITIAL_STATE, error: "Ungültiges Angebot." };

  const supabase = await createClient();
  const statusError = await checkQuoteEditable(supabase, quoteId);
  if (statusError) return { ...INITIAL_STATE, error: statusError };

  const { error: validationError, input } = parseItemForm(formData);
  if (validationError || !input) return { ...INITIAL_STATE, error: validationError };

  const { error } = await supabase.from("quote_items").update(input).eq("id", itemId);
  if (error) {
    if (readonlyErrorMessage(error.message)) {
      return { ...INITIAL_STATE, error: "Testphase abgelaufen – Bearbeiten ist gesperrt." };
    }
    return { ...INITIAL_STATE, error: "Position konnte nicht gespeichert werden." };
  }

  await recalculateQuoteTotals(supabase, quoteId);

  revalidatePath(`/angebote/${quoteId}`);
  return { ...INITIAL_STATE, successAt: Date.now() };
}

export async function removeQuoteItem(
  _prevState: QuoteItemActionState,
  formData: FormData,
): Promise<QuoteItemActionState> {
  const context = await getUserContext();
  if (!context || !isAdminOrProjektleiter(context.role)) {
    return { ...INITIAL_STATE, error: "Nur Admin oder Projektleiter können Positionen entfernen." };
  }
  if (!context.isWritable) {
    return { ...INITIAL_STATE, error: "Testphase abgelaufen – Bearbeiten ist gesperrt." };
  }

  const itemId = String(formData.get("id") ?? "");
  const quoteId = String(formData.get("quoteId") ?? "");
  if (!itemId || !quoteId) return { ...INITIAL_STATE, error: "Ungültige Position." };

  const supabase = await createClient();
  const statusError = await checkQuoteEditable(supabase, quoteId);
  if (statusError) return { ...INITIAL_STATE, error: statusError };

  const { error } = await supabase.from("quote_items").delete().eq("id", itemId);
  if (error) {
    if (readonlyErrorMessage(error.message)) {
      return { ...INITIAL_STATE, error: "Testphase abgelaufen – Bearbeiten ist gesperrt." };
    }
    return { ...INITIAL_STATE, error: "Position konnte nicht entfernt werden." };
  }

  await recalculateQuoteTotals(supabase, quoteId);

  revalidatePath(`/angebote/${quoteId}`);
  return { ...INITIAL_STATE, successAt: Date.now() };
}

export async function reorderQuoteItems(
  quoteId: string,
  orderedIds: string[],
): Promise<{ error: string | null }> {
  const context = await getUserContext();
  if (!context || !isAdminOrProjektleiter(context.role)) {
    return { error: "Nur Admin oder Projektleiter können Positionen umsortieren." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("reorder_quote_items", {
    p_quote_id: quoteId,
    p_ordered_ids: orderedIds,
  });

  if (error) {
    return {
      error: readonlyErrorMessage(error.message)
        ? "Testphase abgelaufen – Bearbeiten ist gesperrt."
        : "Umsortieren fehlgeschlagen.",
    };
  }

  revalidatePath(`/angebote/${quoteId}`);
  return { error: null };
}
