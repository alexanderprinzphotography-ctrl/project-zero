import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Leistungskatalog</h1>
        <p className="mt-1 text-muted-foreground">
          Standard-Leistungen und Artikel mit Einheit und Netto-Preis – die Grundlage für Angebote.
        </p>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="q" className="text-sm font-medium">
            Suche
          </label>
          <input
            id="q"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Name oder Artikelnummer…"
            className="rounded-md border border-input bg-transparent px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="category" className="text-sm font-medium">
            Kategorie
          </label>
          <select
            id="category"
            name="category"
            defaultValue={category ?? ""}
            className="rounded-md border border-input bg-transparent px-2 py-2 text-sm"
          >
            <option value="">Alle Kategorien</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input type="checkbox" name="showInactive" value="1" defaultChecked={includeInactive} />
          Inaktive anzeigen
        </label>
        <Button type="submit" variant="outline" size="sm">
          Filtern
        </Button>
      </form>

      <CatalogItemList items={items} canEdit={canEdit} />
    </div>
  );
}
