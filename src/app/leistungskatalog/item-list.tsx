"use client";

import { useState } from "react";
import { ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/core/ui/empty-state";
import { ListContainer } from "@/core/ui/list";
import type { CatalogItem } from "@/core/catalog/item";
import { createCatalogItem } from "./actions";
import { CatalogItemForm } from "./item-form";
import { CatalogItemRow } from "./item-row";

export function CatalogItemList({
  items,
  canEdit,
  hasFilters,
}: {
  items: CatalogItem[];
  canEdit: boolean;
  hasFilters?: boolean;
}) {
  const [showCreateForm, setShowCreateForm] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      {canEdit &&
        (showCreateForm ? (
          <Card>
            <CardHeader>
              <CardTitle>Neue Leistung</CardTitle>
            </CardHeader>
            <CardContent>
              <CatalogItemForm
                action={createCatalogItem}
                onCancel={() => setShowCreateForm(false)}
                onSuccess={() => setShowCreateForm(false)}
                submitLabel="Leistung speichern"
              />
            </CardContent>
          </Card>
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

      {items.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={hasFilters ? "Keine Leistungen für diese Filter." : "Noch keine Leistungen."}
        />
      ) : (
        <ListContainer>
          {items.map((item) => (
            <CatalogItemRow key={item.id} item={item} canEdit={canEdit} />
          ))}
        </ListContainer>
      )}
    </div>
  );
}
