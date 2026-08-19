import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BrevoProvider } from "@/core/email/brevo-provider";
import type { SendTransactionalInput } from "@/core/email/provider";

const INPUT: SendTransactionalInput = {
  to: { email: "kunde@example.com", name: "Erika Musterfrau" },
  replyTo: { email: "info@mustermann-bau.de", name: "Mustermann Bau GmbH" },
  senderName: "Mustermann Bau GmbH (via Baustellen-Zentrale)",
  subject: "Ihr Angebot #42",
  html: "<p>Hallo</p>",
  text: "Hallo",
};

beforeEach(() => {
  process.env.BREVO_API_KEY = "test-brevo-key-secret";
  process.env.BREVO_SENDER_EMAIL = "angebot@baustellen-zentrale.de";
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.BREVO_API_KEY;
  delete process.env.BREVO_SENDER_EMAIL;
});

describe("BrevoProvider.sendTransactional", () => {
  it("sendet erfolgreich und liefert die messageId zurück", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ messageId: "<abc123@relay.brevo.com>" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await new BrevoProvider().sendTransactional(INPUT);

    expect(result).toEqual({ ok: true, messageId: "<abc123@relay.brevo.com>" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    expect(init.headers["api-key"]).toBe("test-brevo-key-secret");

    const body = JSON.parse(init.body);
    expect(body.sender.email).toBe("angebot@baustellen-zentrale.de");
    expect(body.to[0].email).toBe("kunde@example.com");
    expect(body.replyTo.email).toBe("info@mustermann-bau.de");
  });

  it("meldet einen ungültigen Key als klaren Fehler, ohne den Key preiszugeben", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401 }));

    const result = await new BrevoProvider().sendTransactional(INPUT);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).not.toContain("test-brevo-key-secret");
    }
  });

  it("meldet fehlende Konfiguration klar, statt mit undefined zu senden", async () => {
    delete process.env.BREVO_API_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await new BrevoProvider().sendTransactional(INPUT);

    expect(result.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("gibt die Brevo-Fehlermeldung aus dem Response-Body weiter (Diagnose)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({ code: "invalid_parameter", message: "Invalid recipient email" }),
      }),
    );

    const result = await new BrevoProvider().sendTransactional(INPUT);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("Invalid recipient email");
    }
  });
});
