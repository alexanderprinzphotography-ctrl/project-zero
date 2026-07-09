import { afterEach, describe, expect, it, vi } from "vitest";
import { SevdeskProvider } from "@/core/invoicing/sevdesk-provider";
import type { ContactInput } from "@/core/invoicing/provider";

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
