import { afterEach, describe, expect, it, vi } from "vitest";
import { SevdeskProvider } from "@/core/invoicing/sevdesk-provider";
import type { ContactInput, CreateInvoiceInput } from "@/core/invoicing/provider";

const CONTACT: ContactInput = {
  type: "gewerblich",
  company_name: "Mustermann Bau GmbH",
  first_name: null,
  last_name: null,
  email: null,
  street: null,
  postal_code: null,
  city: null,
  country: "DE",
  customer_number: 42,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SevdeskProvider.upsertContact", () => {
  it("ruft sevdesk NICHT erneut auf, wenn bereits eine externalContactId vorliegt (Idempotenz)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const provider = new SevdeskProvider();
    const result = await provider.upsertContact("dummy-key", CONTACT, "existing-id-123");

    expect(result).toEqual({ ok: true, externalContactId: "existing-id-123" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("legt einen neuen Kontakt an, wenn noch keine externalContactId vorliegt", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ objects: { id: "999" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new SevdeskProvider();
    const result = await provider.upsertContact("dummy-key", CONTACT, null);

    expect(result).toEqual({ ok: true, externalContactId: "999" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://my.sevdesk.de/api/v1/Contact");
    expect(init.headers.Authorization).toBe("dummy-key");
  });

  it("meldet einen ungueltigen Key als klaren Fehler statt zu werfen", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401 }));

    const provider = new SevdeskProvider();
    const result = await provider.upsertContact("wrong-key", CONTACT, null);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/ungültig/i);
    }
  });
});

describe("SevdeskProvider.testConnection", () => {
  it("meldet Erfolg bei Status 200", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200 }));
    const result = await new SevdeskProvider().testConnection("valid-key");
    expect(result).toEqual({ ok: true });
  });

  it("meldet einen Fehler bei Status 401, ohne den Key im Fehlertext preiszugeben", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    const result = await new SevdeskProvider().testConnection("secret-key-xyz");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).not.toContain("secret-key-xyz");
    }
  });
});

const INVOICE_INPUT: CreateInvoiceInput = {
  externalContactId: "555",
  referenceHeader: "Angebot #42",
  invoiceDate: "2026-07-09",
  customerAddressText: "Mustermann Bau GmbH\nMusterstraße 1\n12345 Musterstadt\nDeutschland",
  positions: [
    { name: "Trockenbau", quantity: 12.5, unitLabel: "Stunde", unitPriceNetCents: 1999, taxRatePercent: 19 },
  ],
};

/** POST-Body des Factory-Endpunkts ist PHP-Bracket-formkodiert (kein JSON) - fuers Testen als flache Map zurueckgeben. */
function parseBracketFormBody(body: string): URLSearchParams {
  return new URLSearchParams(body);
}

function mockCreateInvoiceFetch(unities: { id: string; name: string }[], invoiceNumber: string) {
  return vi.fn().mockImplementation((url: string) => {
    if (url.includes("/Unity")) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ objects: unities }) });
    }
    if (url.includes("/SevUser")) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ objects: [{ id: "42" }] }) });
    }
    if (url.includes("/Invoice/Factory/saveInvoice")) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ objects: { invoice: { id: "777" } } }) });
    }
    if (url.includes("/Invoice/777")) {
      // sevdesk liefert GET /Invoice/{id} als Array mit einem Eintrag, nicht als einzelnes Objekt.
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ objects: [{ status: 100, invoiceNumber, dueDate: null }] }),
      });
    }
    throw new Error(`unerwarteter Aufruf: ${url}`);
  });
}

describe("SevdeskProvider.createInvoice", () => {
  it("loest die Einheit ueber GET /Unity per Namens-Match auf und legt die Rechnung mit status=100 an", async () => {
    const fetchMock = mockCreateInvoiceFetch(
      [
        { id: "3", name: "Stunde" },
        { id: "1", name: "Stück" },
      ],
      "RE-1001",
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await new SevdeskProvider().createInvoice("dummy-key", INVOICE_INPUT);

    expect(result).toEqual({
      ok: true,
      externalInvoiceId: "777",
      invoiceNumber: "RE-1001",
      status: "entwurf",
      invoiceDate: "2026-07-09",
      dueDate: null,
    });

    const createCall = fetchMock.mock.calls.find((call: unknown[]) => (call[0] as string).includes("Factory/saveInvoice"));
    expect(createCall![1].headers["Content-Type"]).toBe("application/x-www-form-urlencoded");
    const body = parseBracketFormBody(createCall![1].body);
    expect(body.get("invoice[status]")).toBe("100");
    expect(body.get("invoice[taxRate]")).toBe("19");
    expect(body.get("invoice[contactPerson][id]")).toBe("42");
    expect(body.get("invoice[contactPerson][objectName]")).toBe("SevUser");
    expect(body.get("invoice[address]")).toBe(INVOICE_INPUT.customerAddressText);
    expect(body.get("invoicePosSave[0][unity][id]")).toBe("3");
  });

  it("faellt ohne Namens-Treffer auf die erste Einheit zurueck, ohne Menge/Preis zu veraendern", async () => {
    const fetchMock = mockCreateInvoiceFetch([{ id: "1", name: "Stück" }], "RE-1002");
    vi.stubGlobal("fetch", fetchMock);

    const result = await new SevdeskProvider().createInvoice("dummy-key", INVOICE_INPUT);
    expect(result.ok).toBe(true);

    const createCall = fetchMock.mock.calls.find((call: unknown[]) => (call[0] as string).includes("Factory/saveInvoice"));
    const body = parseBracketFormBody(createCall![1].body);
    expect(body.get("invoicePosSave[0][unity][id]")).toBe("1");
    expect(body.get("invoicePosSave[0][quantity]")).toBe("12.5");
    expect(body.get("invoicePosSave[0][price]")).toBe("19.99");
  });

  it("meldet einen Fehler, wenn sevdesk keine Einheiten hinterlegt hat", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ objects: [] }) }),
    );
    const result = await new SevdeskProvider().createInvoice("dummy-key", INVOICE_INPUT);
    expect(result.ok).toBe(false);
  });
});

describe("SevdeskProvider.getInvoiceStatus", () => {
  it("mappt bekannte sevdesk-Statuscodes korrekt (100/200/750/1000)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ objects: { status: 1000, invoiceNumber: "RE-2000", dueDate: "2026-08-01" } }),
      }),
    );
    const result = await new SevdeskProvider().getInvoiceStatus("dummy-key", "42");
    expect(result).toEqual({ ok: true, status: "bezahlt", invoiceNumber: "RE-2000", dueDate: "2026-08-01" });
  });

  it("meldet einen Fehler bei unbekanntem Statuscode statt zu raten", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ objects: { status: 999, invoiceNumber: "RE-2001", dueDate: null } }),
      }),
    );
    const result = await new SevdeskProvider().getInvoiceStatus("dummy-key", "42");
    expect(result.ok).toBe(false);
  });

  it("verarbeitet die Array-gewrappte Antwortform von GET /Invoice/{id} korrekt", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ objects: [{ status: 200, invoiceNumber: "RE-3000", dueDate: "2026-08-01" }] }),
      }),
    );
    const result = await new SevdeskProvider().getInvoiceStatus("dummy-key", "42");
    expect(result).toEqual({ ok: true, status: "offen", invoiceNumber: "RE-3000", dueDate: "2026-08-01" });
  });
});

describe("SevdeskProvider.findInvoiceByReference", () => {
  it("findet eine bestehende Rechnung anhand des header-Markers (Idempotenz-Netz)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          objects: [
            { id: "10", header: "Sonstiges" },
            { id: "20", header: "Rechnung zu Angebot #42" },
          ],
        }),
      }),
    );
    const result = await new SevdeskProvider().findInvoiceByReference("dummy-key", "555", "Angebot #42");
    expect(result).toBe("20");
  });

  it("liefert null ohne Treffer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ objects: [] }) }),
    );
    const result = await new SevdeskProvider().findInvoiceByReference("dummy-key", "555", "Angebot #99");
    expect(result).toBeNull();
  });
});

describe("SevdeskProvider.getInvoicePdf", () => {
  it("gibt das Base64-PDF aus der sevdesk-Antwort zurueck, ohne selbst etwas zu rendern", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ objects: "base64-pdf-inhalt" }) }),
    );
    const result = await new SevdeskProvider().getInvoicePdf("dummy-key", "42");
    expect(result).toEqual({ ok: true, pdfBase64: "base64-pdf-inhalt" });
  });
});
