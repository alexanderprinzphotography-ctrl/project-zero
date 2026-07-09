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

/** Gespiegelter Status - identisch zum invoices.status-Enum der DB. */
export type MirroredInvoiceStatus = "entwurf" | "offen" | "bezahlt" | "teilbezahlt" | "storniert";

export type InvoicePosition = {
  name: string;
  /** Dezimal-Menge, z. B. 12.5 - identisch zu quote_items.quantity. */
  quantity: number;
  unitLabel: string;
  /** Netto-Einzelpreis in Cent (Snapshot aus dem Angebot, keine Neuberechnung). */
  unitPriceNetCents: number;
  taxRatePercent: number;
};

export type CreateInvoiceInput = {
  externalContactId: string;
  /** Freitext-Marker im Rechnungskopf, z. B. "Angebot #42" - dient auch der Wiedererkennung (findInvoiceByReference). */
  referenceHeader: string;
  invoiceDate: string;
  positions: InvoicePosition[];
};

export type CreateInvoiceResult =
  | {
      ok: true;
      externalInvoiceId: string;
      invoiceNumber: string;
      status: MirroredInvoiceStatus;
      invoiceDate: string;
      dueDate: string | null;
    }
  | { ok: false; error: string };

export type InvoiceStatusResult =
  | { ok: true; status: MirroredInvoiceStatus; invoiceNumber: string; dueDate: string | null }
  | { ok: false; error: string };

export type InvoicePdfResult = { ok: true; pdfBase64: string } | { ok: false; error: string };

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

  /** Erstellt die Rechnung beim Anbieter - Beträge/Mengen kommen 1:1 aus dem Angebot, keine Neuberechnung hier. */
  createInvoice(apiKey: string, input: CreateInvoiceInput): Promise<CreateInvoiceResult>;

  /** Liest den aktuellen Status (offen/bezahlt/...) beim Anbieter - die App berechnet ihn nie selbst. */
  getInvoiceStatus(apiKey: string, externalInvoiceId: string): Promise<InvoiceStatusResult>;

  /** Holt das vom Anbieter erzeugte PDF - die App rendert nie ein eigenes Rechnungs-PDF. */
  getInvoicePdf(apiKey: string, externalInvoiceId: string): Promise<InvoicePdfResult>;

  /**
   * Sucht eine bereits existierende Rechnung beim Anbieter anhand des
   * referenceHeader-Markers - zweite Idempotenz-Schicht fuer den Fall, dass
   * ein vorheriger createInvoice-Aufruf beim Anbieter erfolgreich war, aber
   * die eigene DB-Schreibung danach fehlgeschlagen ist (z. B. Timeout).
   */
  findInvoiceByReference(
    apiKey: string,
    externalContactId: string,
    referenceMarker: string,
  ): Promise<string | null>;
}
