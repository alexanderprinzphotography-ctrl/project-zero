import { describe, expect, it } from "vitest";
import { buildQuoteEmailContent } from "@/core/email/quote-email-template";

const BASE_INPUT = {
  companyName: "Mustermann Bau GmbH",
  logoUrl: null,
  primaryColor: "#1d4ed8",
  quoteNumber: 42,
  grossTotalCents: 297_36,
  validUntil: "2026-08-08",
  portalUrl: "https://baustellen-zentrale.de/angebot/abc123token",
  personalMessage: null,
  contactPhone: "+49 30 12345678",
  replyToEmail: "info@mustermann-bau.de",
};

describe("buildQuoteEmailContent", () => {
  it("enthält den Portal-Link, die Rechnungsnummer und den Betrag in HTML und Text", () => {
    const { html, text } = buildQuoteEmailContent(BASE_INPUT);

    expect(html).toContain("https://baustellen-zentrale.de/angebot/abc123token");
    expect(html).toContain("#42");
    expect(html).toContain("297,36");
    expect(text).toContain("https://baustellen-zentrale.de/angebot/abc123token");
    expect(text).toContain("297,36");
  });

  it("escaped eine persönliche Nachricht mit HTML/Script-Inhalt (kein XSS)", () => {
    const { html, text } = buildQuoteEmailContent({
      ...BASE_INPUT,
      personalMessage: '<script>alert("xss")</script> Vielen Dank für Ihre Anfrage!',
    });

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    // Im reinen Text-Fallback ist keine Entschärfung nötig (kein HTML-Renderer liest ihn).
    expect(text).toContain('<script>alert("xss")</script>');
  });

  it("escaped den Firmennamen in HTML (Verteidigung gegen manipulierte Firmendaten)", () => {
    const { html } = buildQuoteEmailContent({
      ...BASE_INPUT,
      companyName: '<img src=x onerror=alert(1)>',
    });

    expect(html).not.toContain("<img src=x onerror");
    expect(html).toContain("&lt;img");
  });

  it("zeigt kein Telefon-/Logo-Element, wenn nicht vorhanden", () => {
    const { html } = buildQuoteEmailContent({ ...BASE_INPUT, contactPhone: null, logoUrl: null });
    expect(html).not.toContain("Tel.");
  });
});
