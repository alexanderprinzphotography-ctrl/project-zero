"use client";

import { useActionState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/core/ui/field";
import { FormMessage } from "@/core/ui/form-message";
import { centsToEuroInputValue } from "@/core/money/cents";
import type { CatalogItem } from "@/core/catalog/item";
import { type CatalogActionState } from "./actions";

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
        <Field label="Name" htmlFor="name">
          <Input id="name" name="name" defaultValue={item?.name ?? ""} required />
        </Field>
        <Field label="Artikelnummer (optional)" htmlFor="itemNumber">
          <Input
            id="itemNumber"
            name="itemNumber"
            defaultValue={item?.item_number ?? ""}
            placeholder="automatisch, wenn leer"
          />
        </Field>
        <Field label="Einheit" htmlFor="unit">
          <Input
            id="unit"
            name="unit"
            defaultValue={item?.unit ?? ""}
            placeholder="Stk, Std, m², m, pauschal…"
            required
          />
        </Field>
        <Field label="Netto-Einzelpreis (€)" htmlFor="unitPriceEuro">
          <Input
            id="unitPriceEuro"
            name="unitPriceEuro"
            defaultValue={item ? centsToEuroInputValue(item.unit_price_net_cents) : ""}
            placeholder="19,99"
            inputMode="decimal"
            required
          />
        </Field>
        <Field label="Kategorie (optional)" htmlFor="itemCategory">
          <Input id="itemCategory" name="category" defaultValue={item?.category ?? ""} />
        </Field>
      </div>

      <Field label="Beschreibung (optional)" htmlFor="description">
        <Textarea id="description" name="description" rows={3} defaultValue={item?.description ?? ""} />
      </Field>

      <FormMessage error={state.error} />

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
