"use client";

import { useActionState, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ListRow } from "@/core/ui/list";
import { formatCentsAsEuro } from "@/core/money/cents";
import { decimalNumberToHundredths, hundredthsToQuantityInputValue } from "@/core/money/quote-math";
import type { QuoteItem } from "@/core/quotes/quote";
import { addQuoteItem, removeQuoteItem, reorderQuoteItems, updateQuoteItem, type QuoteItemActionState } from "./item-actions";
import { QuoteItemForm, type CatalogItemOption } from "./quote-item-form";

const INITIAL_STATE: QuoteItemActionState = { error: null, successAt: null };

function RemoveItemButton({ id, quoteId }: { id: string; quoteId: string }) {
  const [state, formAction, pending] = useActionState(removeQuoteItem, INITIAL_STATE);

  return (
    <form action={formAction} className="inline-flex flex-col items-end gap-1">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="quoteId" value={quoteId} />
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        {pending ? "…" : "Entfernen"}
      </Button>
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
    </form>
  );
}

export function QuoteItemList({
  quoteId,
  items,
  catalogItems,
  canEdit,
}: {
  quoteId: string;
  items: QuoteItem[];
  catalogItems: CatalogItemOption[];
  canEdit: boolean;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [reorderError, setReorderError] = useState<string | null>(null);

  async function moveItem(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= items.length) return;
    const reordered = [...items];
    const tmp = reordered[index];
    reordered[index] = reordered[targetIndex];
    reordered[targetIndex] = tmp;
    const result = await reorderQuoteItems(
      quoteId,
      reordered.map((i) => i.id),
    );
    setReorderError(result.error);
  }

  return (
    <div className="flex flex-col gap-2">
      {items.length === 0 && (
        <p className="text-sm text-muted-foreground">Noch keine Positionen.</p>
      )}
      {reorderError && <p className="text-sm text-destructive">{reorderError}</p>}

      {items.map((item, index) =>
        editingId === item.id ? (
          <QuoteItemForm
            key={item.id}
            quoteId={quoteId}
            item={item}
            catalogItems={catalogItems}
            action={updateQuoteItem.bind(null, item.id)}
            onCancel={() => setEditingId(null)}
            onSuccess={() => setEditingId(null)}
            submitLabel="Änderungen speichern"
          />
        ) : (
          <ListRow key={item.id}>
            <div className="flex flex-col gap-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">Pos. {item.position}</span>
                <span className="font-medium">{item.name}</span>
                {item.is_ai_suggested && <Badge variant="primary">KI-Vorschlag · Menge geschätzt</Badge>}
              </div>
              <span className="text-muted-foreground">
                {hundredthsToQuantityInputValue(decimalNumberToHundredths(Number(item.quantity)))} {item.unit} ×{" "}
                {formatCentsAsEuro(item.unit_price_net_cents)}
              </span>
              {item.ai_note && <span className="text-xs text-muted-foreground italic">{item.ai_note}</span>}
            </div>
            <div className="flex items-center gap-3">
              <span className="font-medium">{formatCentsAsEuro(item.line_total_net_cents)}</span>
              {canEdit && (
                <>
                  <div className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => moveItem(index, -1)}
                      disabled={index === 0}
                      className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
                      aria-label="Nach oben"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      onClick={() => moveItem(index, 1)}
                      disabled={index === items.length - 1}
                      className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-30"
                      aria-label="Nach unten"
                    >
                      ▼
                    </button>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setEditingId(item.id)}>
                    Bearbeiten
                  </Button>
                  <RemoveItemButton id={item.id} quoteId={quoteId} />
                </>
              )}
            </div>
          </ListRow>
        ),
      )}

      {canEdit &&
        (showAddForm ? (
          <QuoteItemForm
            quoteId={quoteId}
            catalogItems={catalogItems}
            action={addQuoteItem}
            onCancel={() => setShowAddForm(false)}
            onSuccess={() => setShowAddForm(false)}
            submitLabel="Position hinzufügen"
          />
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowAddForm(true)}
            className="w-fit"
          >
            + Position hinzufügen
          </Button>
        ))}
    </div>
  );
}
