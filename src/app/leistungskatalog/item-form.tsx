"use client";

import { useActionState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { centsToEuroInputValue } from "@/core/money/cents";
import type { CatalogItem } from "@/core/catalog/item";
import { type CatalogActionState } from "./actions";

const fieldClass =
  "rounded-md border border-input bg-transparent px-3 py-2 text-base outline-none focus:ring-2 focus:ring-ring";

const INITIAL_STATE: CatalogActionState = { error: null, successAt: null };

export function CatalogItemForm({
  item,
  action,
  onCancel,
  onSuccess,
  submitLabel,
}: {
  item?: CatalogItem;
  action: (prevState: CatalogActionState, formData: FormData) => Promise<CatalogActionState>;
  onCancel?: () => void;
  onSuccess?: () => void;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);

  useEffect(() => {
    if (state.successAt) onSuccess?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.successAt]);

  return (
    <form
      action={formAction}
      // Vorsichtsmassnahme (siehe MS 6/7): React setzt Formulare nach jedem
      // Action-Aufruf nativ zurueck, auch bei einem reinen Validierungsfehler.
      onReset={(e) => e.preventDefault()}
      className="flex flex-col gap-4"
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className="text-sm font-medium">
            Name
          </label>
          <input id="name" name="name" defaultValue={item?.name ?? ""} required className={fieldClass} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="itemNumber" className="text-sm font-medium">
            Artikelnummer (optional)
          </label>
          <input
            id="itemNumber"
            name="itemNumber"
            defaultValue={item?.item_number ?? ""}
            placeholder="automatisch, wenn leer"
            className={fieldClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="unit" className="text-sm font-medium">
            Einheit
          </label>
          <input
            id="unit"
            name="unit"
            defaultValue={item?.unit ?? ""}
            placeholder="Stk, Std, m², m, pauschal…"
            required
            className={fieldClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="unitPriceEuro" className="text-sm font-medium">
            Netto-Einzelpreis (€)
          </label>
          <input
            id="unitPriceEuro"
            name="unitPriceEuro"
            defaultValue={item ? centsToEuroInputValue(item.unit_price_net_cents) : ""}
            placeholder="19,99"
            inputMode="decimal"
            required
            className={fieldClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="itemCategory" className="text-sm font-medium">
            Kategorie (optional)
          </label>
          <input
            id="itemCategory"
            name="category"
            defaultValue={item?.category ?? ""}
            className={fieldClass}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="description" className="text-sm font-medium">
          Beschreibung (optional)
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={item?.description ?? ""}
          className={fieldClass}
        />
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending} className="w-fit">
          {pending ? "Wird gespeichert…" : submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} className="w-fit">
            Abbrechen
          </Button>
        )}
      </div>
    </form>
  );
}
