import type { AiDraftMatch } from "@/core/quotes/ai-draft";

/**
 * Sicherheitsschicht gegen Halluzination: die KI darf NUR ueber diese Funktion
 * in echte quote_items uebersetzt werden. Jede catalog_item_id wird gegen den
 * ECHTEN, frisch aus der DB geladenen Firmen-Katalog geprueft - Preis/Name/
 * Einheit kommen ausschliesslich aus diesem Katalog-Datensatz (Snapshot), NIE
 * aus der KI-Antwort selbst. Nicht existierende IDs werden still verworfen
 * (kein Crash, keine erfundene Position).
 */

export type CatalogItemForValidation = {
  id: string;
  name: string;
  unit: string;
  unit_price_net_cents: number;
};

export type ValidatedAiQuoteItem = {
  catalogItemId: string;
  name: string;
  unit: string;
  unitPriceNetCents: number;
  quantityHundredths: number;
  aiNote: string | null;
};

export function validateAiMatches(
  matches: AiDraftMatch[],
  catalog: CatalogItemForValidation[],
): ValidatedAiQuoteItem[] {
  const catalogById = new Map(catalog.map((c) => [c.id, c]));
  const validated: ValidatedAiQuoteItem[] = [];

  for (const match of matches) {
    const catalogItem = catalogById.get(match.catalog_item_id);
    if (!catalogItem) continue; // halluzinierte/unbekannte id - verwerfen

    const quantityHundredths = Math.round(match.menge * 100);
    if (!Number.isFinite(quantityHundredths) || quantityHundredths <= 0) continue;

    validated.push({
      catalogItemId: catalogItem.id,
      name: catalogItem.name,
      unit: catalogItem.unit,
      unitPriceNetCents: catalogItem.unit_price_net_cents,
      quantityHundredths,
      aiNote: match.hinweis ?? null,
    });
  }

  return validated;
}
