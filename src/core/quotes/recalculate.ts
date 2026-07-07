import type { createClient } from "@/core/supabase/server";
import { computeQuoteTotals } from "@/core/money/quote-math";

/**
 * Summen aus den gespeicherten (bereits exakten) Zeilen-Totalen neu berechnen
 * und auf quotes speichern - wird nach JEDER inhaltlichen Aenderung aufgerufen
 * (Positionen ODER Kopfdaten wie der Steuersatz). Reine Ganzzahl-Arithmetik,
 * siehe core/money/quote-math.
 *
 * Entzieht dabei zugleich eine bereits erteilte Freigabe: jede inhaltliche
 * Aenderung an einem freigegebenen Angebot setzt es zurueck auf "entwurf" -
 * es muss danach erneut freigegeben werden. So muessen Positions- UND
 * Kopfdaten-Aktionen diese Regel nicht separat duplizieren.
 *
 * Kein Server Action (kein "use server"), nur ein interner Helfer fuer andere
 * Server-Module - daher hier statt in einer Actions-Datei.
 */
export async function recalculateQuoteTotals(
  supabase: Awaited<ReturnType<typeof createClient>>,
  quoteId: string,
): Promise<void> {
  const { data: quote } = await supabase
    .from("quotes")
    .select("tax_rate, status")
    .eq("id", quoteId)
    .single();
  if (!quote) return;

  const { data: items } = await supabase
    .from("quote_items")
    .select("line_total_net_cents")
    .eq("quote_id", quoteId);

  const totals = computeQuoteTotals(
    (items ?? []).map((i) => i.line_total_net_cents),
    quote.tax_rate,
  );

  const update: Record<string, unknown> = {
    net_total_cents: totals.netTotalCents,
    tax_total_cents: totals.taxTotalCents,
    gross_total_cents: totals.grossTotalCents,
  };
  if (quote.status === "freigegeben") {
    update.status = "entwurf";
    update.approved_by = null;
    update.approved_at = null;
  }

  await supabase.from("quotes").update(update).eq("id", quoteId);
}
