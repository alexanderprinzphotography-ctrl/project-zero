"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { CatalogItem } from "@/core/catalog/item";
import { createCatalogItem } from "./actions";
import { CatalogItemForm } from "./item-form";
import { CatalogItemRow } from "./item-row";

export function CatalogItemList({
  items,
  canEdit,
}: {
  items: CatalogItem[];
  canEdit: boolean;
}) {
  const [showCreateForm, setShowCreateForm] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      {canEdit &&
        (showCreateForm ? (
          <div className="rounded-md border border-border p-4">
            <CatalogItemForm
              action={createCatalogItem}
              onCancel={() => setShowCreateForm(false)}
              onSuccess={() => setShowCreateForm(false)}
              submitLabel="Leistung speichern"
            />
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowCreateForm(true)}
            className="w-fit"
          >
            + Neue Leistung
          </Button>
        ))}

      {items.length === 0 && (
        <p className="text-sm text-muted-foreground">Keine Einträge gefunden.</p>
      )}
      {items.map((item) => (
        <CatalogItemRow key={item.id} item={item} canEdit={canEdit} />
      ))}
    </div>
  );
}
