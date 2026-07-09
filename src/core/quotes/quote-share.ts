import type { QuoteStatus } from "./quote";
import type { ProjectStatus } from "@/core/projects/project";

/**
 * Antwortform von get_quote_share()/get_quote_share_items() (MS 12a) -
 * bewusst schlank und snake_case (wie Quote/Contact/Project), NIEMALS
 * quote.id/company_id/customer_id/project_id - der Token bleibt der einzige
 * client-seitige Identifikator.
 */
export type QuoteShareCustomer = {
  type: "privat" | "gewerblich";
  company_name: string | null;
  first_name: string | null;
  last_name: string | null;
  street: string | null;
  postal_code: string | null;
  city: string | null;
  country: string;
};

export type QuoteShareProject = {
  title: string;
  status: ProjectStatus;
  start_date: string | null;
  planned_end_date: string | null;
};

export type QuoteShareResponse = {
  action: "angenommen" | "abgelehnt";
  responded_at: string;
  responder_name: string;
};

export type QuoteShareData =
  | { valid: false }
  | {
      valid: true;
      quote_number: number;
      status: QuoteStatus;
      quote_date: string;
      valid_until: string;
      tax_rate: number;
      intro_text: string | null;
      closing_text: string | null;
      net_total_cents: number;
      tax_total_cents: number;
      gross_total_cents: number;
      company_name: string;
      primary_color: string | null;
      accent_color: string | null;
      logo_url: string | null;
      customer: QuoteShareCustomer;
      project: QuoteShareProject | null;
      response: QuoteShareResponse | null;
    };

export type QuoteShareItem = {
  position: number;
  name: string;
  unit: string;
  quantity: number;
  unit_price_net_cents: number;
  line_total_net_cents: number;
};

/** Kann der Kunde gerade annehmen/ablehnen? Serverseitig ohnehin per RPC erzwungen - hier nur fuer die UI-Anzeige. */
export function canRespondToQuoteShare(share: Extract<QuoteShareData, { valid: true }>): boolean {
  if (share.response) return false;
  if (!["freigegeben", "gesendet"].includes(share.status)) return false;
  return new Date(share.valid_until) >= new Date(new Date().toDateString());
}
