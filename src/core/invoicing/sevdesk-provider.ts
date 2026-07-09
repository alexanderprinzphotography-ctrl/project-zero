import { contactDisplayName } from "@/core/crm/contact";
import type {
  ContactInput,
  InvoiceProvider,
  TestConnectionResult,
  UpsertContactResult,
} from "./provider";

/**
 * sevdesk-Anbindung (MS 11a: nur Verbindungstest + Kontakt-Sync). Ausschliesslich
 * serverseitig verwenden - der API-Key darf den Server nie verlassen und wird
 * hier nie geloggt. sevdesk-Auth: roher Token im Authorization-Header, kein
 * "Bearer"-Praefix, kein OAuth/Ablauf.
 */

const BASE_URL = "https://my.sevdesk.de/api/v1";
const TIMEOUT_MS = 10_000;

// category.id 3 = "Kunde" (sevdesk-Standardkategorie fuer Kontakte).
const CUSTOMER_CATEGORY_ID = 3;

async function sevdeskFetch(apiKey: string, path: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
        ...init?.headers,
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      throw new Error("Zeitüberschreitung bei der Verbindung zu sevdesk.");
    }
    throw new Error("Verbindung zu sevdesk fehlgeschlagen.");
  }
}

function contactName(contact: ContactInput): string {
  if (contact.type === "gewerblich" && contact.company_name?.trim()) {
    return contact.company_name.trim();
  }
  return contactDisplayName(contact);
}

export class SevdeskProvider implements InvoiceProvider {
  async testConnection(apiKey: string): Promise<TestConnectionResult> {
    if (!apiKey.trim()) {
      return { ok: false, error: "API-Schlüssel darf nicht leer sein." };
    }
    let res: Response;
    try {
      res = await sevdeskFetch(apiKey, "/Contact?limit=1");
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Verbindung zu sevdesk fehlgeschlagen." };
    }
    if (res.status === 401 || res.status === 403) {
      return { ok: false, error: "Ungültiger sevdesk-API-Schlüssel." };
    }
    if (!res.ok) {
      return { ok: false, error: `sevdesk antwortete mit Status ${res.status}.` };
    }
    return { ok: true };
  }

  async upsertContact(
    apiKey: string,
    contact: ContactInput,
    existingExternalId: string | null,
  ): Promise<UpsertContactResult> {
    if (existingExternalId) {
      return { ok: true, externalContactId: existingExternalId };
    }

    const name = contactName(contact);
    if (!name || name === "–") {
      return { ok: false, error: "Kontakt hat keinen Namen für sevdesk." };
    }

    const payload = {
      name,
      customerNumber: String(contact.customer_number),
      category: { id: CUSTOMER_CATEGORY_ID, objectName: "Category" },
    };

    let res: Response;
    try {
      res = await sevdeskFetch(apiKey, "/Contact", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Verbindung zu sevdesk fehlgeschlagen." };
    }

    if (res.status === 401 || res.status === 403) {
      return { ok: false, error: "Ungültiger sevdesk-API-Schlüssel." };
    }
    if (res.status === 429) {
      return { ok: false, error: "sevdesk-Rate-Limit erreicht, bitte später erneut versuchen." };
    }
    if (!res.ok) {
      return { ok: false, error: `sevdesk-Kontakt konnte nicht angelegt werden (Status ${res.status}).` };
    }

    const data = (await res.json()) as { objects?: { id?: string | number } };
    const externalContactId = data.objects?.id;
    if (externalContactId === undefined || externalContactId === null) {
      return { ok: false, error: "sevdesk-Antwort enthielt keine Kontakt-ID." };
    }
    return { ok: true, externalContactId: String(externalContactId) };
  }

  async createInvoice(): Promise<never> {
    throw new Error("Rechnungserstellung ist noch nicht implementiert (kommt in MS 11b).");
  }

  async getInvoiceStatus(): Promise<never> {
    throw new Error("Rechnungsstatus ist noch nicht implementiert (kommt in MS 11b).");
  }

  async getInvoicePdf(): Promise<never> {
    throw new Error("Rechnungs-PDF ist noch nicht implementiert (kommt in MS 11b).");
  }
}
