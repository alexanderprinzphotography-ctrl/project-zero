import { describe, expect, it } from "vitest";
import { validateAiMatches, type CatalogItemForValidation } from "@/core/quotes/ai-validation";
import type { AiDraftMatch } from "@/core/quotes/ai-draft";

const catalog: CatalogItemForValidation[] = [
  { id: "real-1", name: "Fliesenverlegung", unit: "m²", unit_price_net_cents: 1999 },
  { id: "real-2", name: "Malerarbeiten", unit: "m²", unit_price_net_cents: 899 },
];

describe("validateAiMatches (Review-Checkpoint: Halluzinations-Schutz)", () => {
  it("uebernimmt eine gueltige catalog_item_id mit Preis/Name/Einheit als Snapshot aus dem Katalog", () => {
    const matches: AiDraftMatch[] = [{ catalog_item_id: "real-1", menge: 12.5, hinweis: "laut Flaeche" }];
    const result = validateAiMatches(matches, catalog);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      catalogItemId: "real-1",
      name: "Fliesenverlegung",
      unit: "m²",
      unitPriceNetCents: 1999,
      quantityHundredths: 1250,
      aiNote: "laut Flaeche",
    });
  });

  it("verwirft eine halluzinierte/unbekannte catalog_item_id komplett (kein Crash, keine erfundene Position)", () => {
    const matches: AiDraftMatch[] = [{ catalog_item_id: "does-not-exist-in-db", menge: 5 }];
    const result = validateAiMatches(matches, catalog);
    expect(result).toHaveLength(0);
  });

  it("verwirft nur die halluzinierte ID, gueltige Treffer in derselben Antwort bleiben erhalten", () => {
    const matches: AiDraftMatch[] = [
      { catalog_item_id: "real-2", menge: 20 },
      { catalog_item_id: "halluziniert", menge: 999 },
    ];
    const result = validateAiMatches(matches, catalog);
    expect(result).toHaveLength(1);
    expect(result[0].catalogItemId).toBe("real-2");
  });

  it("verwirft eine Menge von 0 oder negativ", () => {
    const matches: AiDraftMatch[] = [
      { catalog_item_id: "real-1", menge: 0 },
      { catalog_item_id: "real-1", menge: -5 },
    ];
    expect(validateAiMatches(matches, catalog)).toHaveLength(0);
  });

  it("verwendet NIE einen von der KI mitgegebenen Preis - nur unitPriceNetCents aus dem Katalog-Datensatz", () => {
    // AiDraftMatch hat gar kein Preisfeld im Typ - der Test dokumentiert bewusst,
    // dass selbst ein zusaetzliches Feld in der rohen KI-Antwort ignoriert wuerde.
    const matches = [
      { catalog_item_id: "real-1", menge: 1, unit_price_net_cents: 1 } as AiDraftMatch & {
        unit_price_net_cents: number;
      },
    ];
    const result = validateAiMatches(matches, catalog);
    expect(result[0].unitPriceNetCents).toBe(1999);
  });

  it("leerer Katalog verwirft alle Treffer, ohne zu crashen", () => {
    const matches: AiDraftMatch[] = [{ catalog_item_id: "real-1", menge: 1 }];
    expect(validateAiMatches(matches, [])).toHaveLength(0);
  });
});
