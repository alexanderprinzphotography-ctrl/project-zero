import type { BadgeVariant } from "@/components/ui/badge";

export type QuoteStatus =
  | "entwurf"
  | "zur_freigabe"
  | "freigegeben"
  | "gesendet"
  | "angenommen"
  | "abgelehnt";

export type Quote = {
  id: string;
  quote_number: number;
  customer_id: string;
  project_id: string | null;
  status: QuoteStatus;
  quote_date: string;
  valid_until: string;
  tax_rate: number;
  intro_text: string | null;
  closing_text: string | null;
  net_total_cents: number;
  tax_total_cents: number;
  gross_total_cents: number;
  created_by: string;
  approved_by: string | null;
  approved_at: string | null;
  is_ai_generated: boolean;
  intake_description: string | null;
  intake_rooms: QuoteIntakeRoom[] | null;
  unmatched_items: QuoteUnmatchedItem[] | null;
};

export type QuoteItem = {
  id: string;
  quote_id: string;
  position: number;
  catalog_item_id: string | null;
  name: string;
  unit: string;
  quantity: number;
  unit_price_net_cents: number;
  line_total_net_cents: number;
  is_ai_suggested: boolean;
  ai_note: string | null;
};

export type QuoteIntakeRoom = {
  name: string;
  length: number;
  width: number;
  height: number;
  count: number;
  areaM2: number;
};

export type QuoteUnmatchedItem = { beschreibung: string; hinweis?: string };

export function quoteStatusLabel(status: QuoteStatus): string {
  switch (status) {
    case "entwurf":
      return "Entwurf";
    case "zur_freigabe":
      return "Zur Freigabe";
    case "freigegeben":
      return "Freigegeben";
    case "gesendet":
      return "Gesendet";
    case "angenommen":
      return "Angenommen";
    case "abgelehnt":
      return "Abgelehnt";
  }
}

export function quoteStatusVariant(status: QuoteStatus): BadgeVariant {
  switch (status) {
    case "entwurf":
      return "default";
    case "zur_freigabe":
      return "warning";
    case "freigegeben":
      return "primary";
    case "gesendet":
      return "info";
    case "angenommen":
      return "success";
    case "abgelehnt":
      return "destructive";
  }
}

// Bearbeiten ist nur vor dem Versand sinnvoll - einmal "gesendet" gilt das
// Dokument beim Kunden als verbindlich unterwegs und wird nicht mehr
// nachtraeglich veraendert (weder Positionen noch Kopfdaten).
export const EDITABLE_QUOTE_STATUSES: QuoteStatus[] = ["entwurf", "zur_freigabe", "freigegeben"];

export function isQuoteEditable(status: QuoteStatus): boolean {
  return EDITABLE_QUOTE_STATUSES.includes(status);
}
