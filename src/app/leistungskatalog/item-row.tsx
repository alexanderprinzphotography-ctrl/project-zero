"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatCentsAsEuro } from "@/core/money/cents";
import type { CatalogItem } from "@/core/catalog/item";
import { setCatalogItemActive, updateCatalogItem, type CatalogActionState } from "./actions";
import { CatalogItemForm } from "./item-form";

const INITIAL_STATE: CatalogActionState = { error: null, successAt: null };

function ToggleActiveButton({ item }: { item: CatalogItem }) {
  const [state, formAction, pending] = useActionState(setCatalogItemActive, INITIAL_STATE);

  return (
    <form action={formAction} className="inline-flex flex-col items-end gap-1">
      <input type="hidden" name="id" value={item.id} />
      <input type="hidden" name="active" value={item.is_active ? "false" : "true"} />
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        {pending ? "…" : item.is_active ? "Entfernen" : "Reaktivieren"}
      </Button>
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
    </form>
  );
}

export function CatalogItemRow({ item, canEdit }: { item: CatalogItem; canEdit: boolean }) {
  const [isEditing, setIsEditing] = useState(false);

  if (isEditing) {
    return (
      <div className="rounded-md border border-border p-4">
        <CatalogItemForm
          item={item}
          action={updateCatalogItem.bind(null, item.id)}
          onCancel={() => setIsEditing(false)}
          onSuccess={() => setIsEditing(false)}
          submitLabel="Änderungen speichern"
        />
      </div>
    );
  }

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3 text-sm ${
        item.is_active ? "" : "opacity-60"
      }`}
    >
      <div className="flex flex-col gap-0.5">
        <div className="flex flex-wrap items-center gap-2">
          {item.item_number && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{item.item_number}</span>
          )}
          <span className="font-medium">{item.name}</span>
          <span className="text-muted-foreground">{item.unit}</span>
          {item.category && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {item.category}
            </span>
          )}
          {!item.is_active && <span className="text-xs text-destructive">inaktiv</span>}
        </div>
        {item.description && <p className="text-muted-foreground">{item.description}</p>}
      </div>
      <div className="flex items-center gap-3">
        <span className="font-medium">{formatCentsAsEuro(item.unit_price_net_cents)}</span>
        {canEdit && (
          <>
            <Button type="button" variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
              Bearbeiten
            </Button>
            <ToggleActiveButton item={item} />
          </>
        )}
      </div>
    </div>
  );
}
