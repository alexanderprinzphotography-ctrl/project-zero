import type { Contact } from "@/core/crm/contact";

/**
 * Abstraktion ueber Rechnungs-/Buchhaltungs-Drittsysteme. Die App spricht
 * NIE direkt mit einem konkreten Anbieter (z. B. sevdesk), sondern nur ueber
 * dieses Interface - so kann spaeter ein zweiter Anbieter ergaenzt werden,
 * ohne die App umzuschreiben. Leitprinzip: der Anbieter ist die Quelle der
 * Wahrheit fuer Rechnungsnummer, GoBD-Archivierung und E-Rechnung; die App
 * erzeugt selbst nie eine Rechnungsnummer oder ein Rechnungs-PDF.
 */

export type ContactInput = Pick<
  Contact,
  | "type"
  | "company_name"
  | "first_name"
  | "last_name"
  | "email"
  | "street"
  | "postal_code"
  | "city"
  | "country"
  | "customer_number"
>;

export type TestConnectionResult = { ok: true } | { ok: false; error: string };

export type UpsertContactResult =
  | { ok: true; externalContactId: string }
  | { ok: false; error: string };

export interface InvoiceProvider {
  testConnection(apiKey: string): Promise<TestConnectionResult>;

  /**
   * Legt den Kontakt beim Anbieter an oder findet ihn wieder - idempotent,
   * wenn existingExternalId bereits gesetzt ist (kein erneuter Anlage-Call).
   */
  upsertContact(
    apiKey: string,
    contact: ContactInput,
    existingExternalId: string | null,
  ): Promise<UpsertContactResult>;

  // Ab MS 11b (Rechnungserstellung) - hier nur als Vertrag definiert.
  createInvoice(apiKey: string, ...args: unknown[]): Promise<unknown>;
  getInvoiceStatus(apiKey: string, externalInvoiceId: string): Promise<unknown>;
  getInvoicePdf(apiKey: string, externalInvoiceId: string): Promise<unknown>;
}
