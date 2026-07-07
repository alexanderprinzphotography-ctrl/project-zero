export type CatalogItem = {
  id: string;
  item_number: string | null;
  name: string;
  description: string | null;
  unit: string;
  unit_price_net_cents: number;
  category: string | null;
  is_active: boolean;
};
