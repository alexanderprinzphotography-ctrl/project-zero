import { contactDisplayName } from "@/core/crm/contact";
import { centsToDecimalString } from "@/core/money/cents";
import type {
  ContactInput,
  CreateInvoiceInput,
  CreateInvoiceResult,
  InvoicePdfResult,
  InvoiceProvider,
  InvoiceStatusResult,
  MirroredInvoiceStatus,
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

/** Extrahiert die sevdesk-Fehlermeldung aus einer nicht-ok-Antwort fuer bessere Diagnose - enthaelt nie den API-Key. */
async function extractSevdeskErrorDetail(res: Response): Promise<string | null> {
  try {
    const text = await res.text();
    if (!text) return null;
    try {
      const parsed = JSON.parse(text) as { error?: { message?: string }; message?: string };
      return parsed.error?.message ?? parsed.message ?? text.slice(0, 500);
    } catch {
      return text.slice(0, 500);
    }
  } catch {
    return null;
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

  async createInvoice(apiKey: string, input: CreateInvoiceInput): Promise<CreateInvoiceResult> {
    let unities: SevdeskUnity[];
    let contactPersonId: string;
    try {
      unities = await fetchUnities(apiKey);
      contactPersonId = await fetchDefaultSevUserId(apiKey);
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Verbindung zu sevdesk fehlgeschlagen." };
    }
    if (unities.length === 0) {
      return { ok: false, error: "sevdesk hat keine Einheiten (Unity) hinterlegt." };
    }

    const invoicePosSave = input.positions.map((position) => ({
      objectName: "InvoicePos",
      mapAll: true,
      quantity: position.quantity,
      price: Number(centsToDecimalString(position.unitPriceNetCents)),
      name: position.name,
      taxRate: position.taxRatePercent,
      unity: { id: resolveUnityId(unities, position.unitLabel), objectName: "Unity" },
    }));

    const payload = {
      invoice: {
        objectName: "Invoice",
        mapAll: true,
        contact: { id: input.externalContactId, objectName: "Contact" },
        contactPerson: { id: contactPersonId, objectName: "SevUser" },
        invoiceDate: input.invoiceDate,
        header: input.referenceHeader,
        status: 100,
        invoiceType: "RE",
        currency: "EUR",
        taxType: "default",
        // Angebot/Rechnung verwenden einen einzigen, einheitlichen Steuersatz -
        // sevdesk verlangt ihn zusaetzlich auf Rechnungs-Ebene (nicht nur pro Position).
        taxRate: input.positions[0]?.taxRatePercent ?? 19,
      },
      invoicePosSave,
      invoicePosDelete: null,
      discountSave: null,
      discountDelete: null,
    };

    let createRes: Response;
    try {
      createRes = await sevdeskFetch(apiKey, "/Invoice/Factory/saveInvoice", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Verbindung zu sevdesk fehlgeschlagen." };
    }

    if (createRes.status === 401 || createRes.status === 403) {
      return { ok: false, error: "Ungültiger sevdesk-API-Schlüssel." };
    }
    if (createRes.status === 429) {
      return { ok: false, error: "sevdesk-Rate-Limit erreicht, bitte später erneut versuchen." };
    }
    if (!createRes.ok) {
      const detail = await extractSevdeskErrorDetail(createRes);
      return {
        ok: false,
        error: `Rechnung konnte nicht angelegt werden (sevdesk-Status ${createRes.status}${detail ? `: ${detail}` : ""}).`,
      };
    }

    const created = (await createRes.json()) as { objects?: { invoice?: { id?: string | number } } };
    const externalInvoiceId = created.objects?.invoice?.id;
    if (externalInvoiceId === undefined || externalInvoiceId === null) {
      return { ok: false, error: "sevdesk-Antwort enthielt keine Rechnungs-ID." };
    }

    // Kanonische, vollstaendige Rechnung nachladen statt die Create-Response-Form zu erraten.
    const status = await this.getInvoiceStatus(apiKey, String(externalInvoiceId));
    if (!status.ok) return status;
    return {
      ok: true,
      externalInvoiceId: String(externalInvoiceId),
      invoiceNumber: status.invoiceNumber,
      status: status.status,
      invoiceDate: input.invoiceDate,
      dueDate: status.dueDate,
    };
  }

  async getInvoiceStatus(apiKey: string, externalInvoiceId: string): Promise<InvoiceStatusResult> {
    let res: Response;
    try {
      res = await sevdeskFetch(apiKey, `/Invoice/${externalInvoiceId}`);
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Verbindung zu sevdesk fehlgeschlagen." };
    }
    if (res.status === 401 || res.status === 403) {
      return { ok: false, error: "Ungültiger sevdesk-API-Schlüssel." };
    }
    if (!res.ok) {
      return { ok: false, error: `Rechnungsstatus konnte nicht abgerufen werden (Status ${res.status}).` };
    }

    type SevdeskInvoiceObject = { status?: string | number; invoiceNumber?: string; dueDate?: string | null };
    const data = (await res.json()) as { objects?: SevdeskInvoiceObject | SevdeskInvoiceObject[] };
    // GET /Invoice/{id} liefert objects je nach sevdesk-Version entweder als
    // einzelnes Objekt oder (wie GET /Invoice mit Filtern) als Array mit einem
    // Eintrag - beide Formen abfangen statt eine davon zu erraten.
    const raw = Array.isArray(data.objects) ? data.objects[0] : data.objects;
    if (!raw) {
      return { ok: false, error: "sevdesk-Antwort enthielt keine Rechnungsdaten." };
    }

    const status = mapSevdeskStatus(raw.status);
    if (!status) {
      return { ok: false, error: `Unbekannter sevdesk-Rechnungsstatus (${String(raw.status)}).` };
    }

    return {
      ok: true,
      status,
      invoiceNumber: raw.invoiceNumber ?? "",
      dueDate: raw.dueDate ?? null,
    };
  }

  async getInvoicePdf(apiKey: string, externalInvoiceId: string): Promise<InvoicePdfResult> {
    let res: Response;
    try {
      res = await sevdeskFetch(apiKey, `/Invoice/${externalInvoiceId}/getPdf?download=false`);
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Verbindung zu sevdesk fehlgeschlagen." };
    }
    if (!res.ok) {
      return { ok: false, error: `PDF konnte nicht abgerufen werden (Status ${res.status}).` };
    }

    const data = (await res.json()) as { objects?: string };
    if (!data.objects) {
      return { ok: false, error: "sevdesk-Antwort enthielt kein PDF." };
    }
    return { ok: true, pdfBase64: data.objects };
  }

  async findInvoiceByReference(
    apiKey: string,
    externalContactId: string,
    referenceMarker: string,
  ): Promise<string | null> {
    let res: Response;
    try {
      res = await sevdeskFetch(apiKey, `/Invoice?contact[id]=${encodeURIComponent(externalContactId)}&contact[objectName]=Contact`);
    } catch {
      return null;
    }
    if (!res.ok) return null;

    const data = (await res.json()) as { objects?: { id?: string | number; header?: string | null }[] };
    const match = (data.objects ?? []).find((invoice) => invoice.header?.includes(referenceMarker));
    return match?.id !== undefined && match?.id !== null ? String(match.id) : null;
  }
}

type SevdeskUnity = { id: string; name: string };

async function fetchUnities(apiKey: string): Promise<SevdeskUnity[]> {
  const res = await sevdeskFetch(apiKey, "/Unity");
  if (!res.ok) {
    throw new Error(`Einheiten konnten nicht von sevdesk geladen werden (Status ${res.status}).`);
  }
  const data = (await res.json()) as { objects?: { id?: string | number; name?: string }[] };
  return (data.objects ?? [])
    .filter((u) => u.id !== undefined && u.id !== null && u.name)
    .map((u) => ({ id: String(u.id), name: String(u.name) }));
}

/**
 * sevdesk verlangt bei der Rechnungserstellung einen Ansprechpartner
 * (contactPerson, ein SevUser - der Mitarbeiter, nicht der Kunde). Da pro
 * Firma i. d. R. genau ein sevdesk-Nutzer mit dem verbundenen API-Token
 * existiert, wird schlicht der erste zurueckgelieferte Nutzer verwendet.
 */
async function fetchDefaultSevUserId(apiKey: string): Promise<string> {
  const res = await sevdeskFetch(apiKey, "/SevUser");
  if (!res.ok) {
    throw new Error(`sevdesk-Benutzer konnte nicht ermittelt werden (Status ${res.status}).`);
  }
  const data = (await res.json()) as { objects?: { id?: string | number }[] };
  const id = data.objects?.[0]?.id;
  if (id === undefined || id === null) {
    throw new Error("sevdesk hat keinen Benutzer für den Rechnungs-Ansprechpartner geliefert.");
  }
  return String(id);
}

/** Case-insensitives Namens-Matching gegen unser Freitext-Einheiten-Feld; ohne Treffer erste Einheit als kosmetischer Fallback (beeinflusst weder Menge noch Preis). */
function resolveUnityId(unities: SevdeskUnity[], unitLabel: string): string | undefined {
  const needle = unitLabel.trim().toLowerCase();
  const match = unities.find((u) => u.name.trim().toLowerCase() === needle);
  return (match ?? unities[0])?.id;
}

function mapSevdeskStatus(raw: string | number | undefined): MirroredInvoiceStatus | null {
  switch (String(raw)) {
    case "100":
      return "entwurf";
    case "200":
      return "offen";
    case "750":
      return "teilbezahlt";
    case "1000":
      return "bezahlt";
    default:
      return null;
  }
}
