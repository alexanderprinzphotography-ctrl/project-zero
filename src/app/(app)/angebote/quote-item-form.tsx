"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { centsToEuroInputValue } from "@/core/money/cents";
import { decimalNumberToHundredths, hundredthsToQuantityInputValue } from "@/core/money/quote-math";
import type { QuoteItem } from "@/core/quotes/quote";
import { type QuoteItemActionState } from "./item-actions";

const fieldClass =
  "rounded-md border border-input bg-transparent px-3 py-2 text-base outline-none focus:ring-2 focus:ring-ring";

export type CatalogItemOption = {
  id: string;
  name: string;
  unit: string;
  unit_price_net_cents: number;
};

const INITIAL_STATE: QuoteItemActionState = { error: null, successAt: null };

export function QuoteItemForm({
  quoteId,
  item,
  catalogItems,
  action,
  onCancel,
  onSuccess,
  submitLabel,
}: {
  quoteId: string;
  item?: QuoteItem;
  catalogItems: CatalogItemOption[];
  action: (prevState: QuoteItemActionState, formData: FormData) => Promise<QuoteItemActionState>;
  onCancel?: () => void;
  onSuccess?: () => void;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);

  const [catalogItemId, setCatalogItemId] = useState(item?.catalog_item_id ?? "");
  const [name, setName] = useState(item?.name ?? "");
  const [unit, setUnit] = useState(item?.unit ?? "");
  const [quantity, setQuantity] = useState(
    item ? hundredthsToQuantityInputValue(decimalNumberToHundredths(Number(item.quantity))) : "1",
  );
  const [priceEuro, setPriceEuro] = useState(item ? centsToEuroInputValue(item.unit_price_net_cents) : "");

  useEffect(() => {
    if (state.successAt) onSuccess?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.successAt]);

  function handlePickCatalogItem(id: string) {
    setCatalogItemId(id);
    const picked = catalogItems.find((c) => c.id === id);
    if (picked) {
      setName(picked.name);
      setUnit(picked.unit);
      setPriceEuro(centsToEuroInputValue(picked.unit_price_net_cents));
    }
  }

  return (
    <form
      action={formAction}
      onReset={(e) => e.preventDefault()}
      className="flex flex-col gap-3 rounded-md border border-border p-3"
    >
      <input type="hidden" name="quoteId" value={quoteId} />
      <input type="hidden" name="catalogItemId" value={catalogItemId} />

      {!item && catalogItems.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Aus Katalog übernehmen (optional)</label>
          <select
            value={catalogItemId}
            onChange={(e) => handlePickCatalogItem(e.target.value)}
            className={fieldClass}
          >
            <option value="">Freie Position…</option>
            {catalogItems.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.unit}, {centsToEuroInputValue(c.unit_price_net_cents)} €)
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-4 gap-3">
        <div className="col-span-2 flex flex-col gap-1.5">
          <label className="text-sm font-medium">Bezeichnung</label>
          <input
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className={fieldClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Menge</label>
          <input
            name="quantity"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="12,5"
            required
            className={fieldClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Einheit</label>
          <input
            name="unit"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="Stk, Std, m²…"
            required
            className={fieldClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Einzelpreis netto (€)</label>
          <input
            name="unitPriceEuro"
            value={priceEuro}
            onChange={(e) => setPriceEuro(e.target.value)}
            placeholder="19,99"
            required
            className={fieldClass}
          />
        </div>
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending} className="w-fit">
          {pending ? "Wird gespeichert…" : submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} className="w-fit">
            Abbrechen
          </Button>
        )}
      </div>
    </form>
  );
}
