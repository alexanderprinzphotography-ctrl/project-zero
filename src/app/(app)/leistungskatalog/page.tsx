import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FilterBar, FilterField } from "@/core/ui/filter-bar";
import { PageHeader } from "@/core/ui/page-header";
import { createClient } from "@/core/supabase/server";
import { getUserContext } from "@/core/auth/get-user-context";
import type { CatalogItem } from "@/core/catalog/item";
import { CatalogItemList } from "./item-list";

export default async function LeistungskatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; showInactive?: string }>;
}) {
  const { q, category, showInactive } = await searchParams;
  const context = await getUserContext();
  if (!context) redirect("/login");
  if (!["admin", "projektleiter"].includes(context.role)) redirect("/");

  const canEdit = context.isWritable;
  const includeInactive = showInactive === "1";

  const supabase = await createClient();

  const { data: categoryRows } = await supabase
    .from("catalog_items")
    .select("category")
    .not("category", "is", null)
    .order("category", { ascending: true });
  const categories = Array.from(new Set((categoryRows ?? []).map((r) => r.category as string)));

  let query = supabase
    .from("catalog_items")
    .select("id, item_number, name, description, unit, unit_price_net_cents, category, is_active")
    .order("name", { ascending: true });

  if (!includeInactive) {
    query = query.eq("is_active", true);
  }
  if (category) {
    query = query.eq("category", category);
  }
  if (q) {
    query = query.or(`name.ilike.%${q}%,item_number.ilike.%${q}%`);
  }

  const { data } = await query;
  const items = (data as CatalogItem[] | null) ?? [];
  const hasFilters = Boolean(q || category || includeInactive);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Leistungskatalog"
        description="Standard-Leistungen und Artikel mit Einheit und Netto-Preis – die Grundlage für Angebote."
      />

      <FilterBar method="get">
        <FilterField label="Suche" htmlFor="q">
          <Input
            id="q"
            name="q"
            type="text"
            defaultValue={q ?? ""}
            placeholder="Name oder Artikelnummer…"
            className="w-64"
          />
        </FilterField>
        <FilterField label="Kategorie" htmlFor="category">
          <select
            id="category"
            name="category"
            defaultValue={category ?? ""}
            className="h-10 rounded-md border border-input bg-transparent px-2 text-sm"
          >
            <option value="">Alle Kategorien</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </FilterField>
        <label className="flex items-center gap-2 pb-2.5 text-sm">
          <input type="checkbox" name="showInactive" value="1" defaultChecked={includeInactive} />
          Inaktive anzeigen
        </label>
        <Button type="submit" variant="outline" size="sm">
          Filtern
        </Button>
      </FilterBar>

      <CatalogItemList items={items} canEdit={canEdit} hasFilters={hasFilters} />
    </div>
  );
}
