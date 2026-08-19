import { formatCentsAsEuro } from "@/core/money/cents";

export type QuoteEmailContentInput = {
  companyName: string;
  logoUrl: string | null;
  primaryColor: string | null;
  quoteNumber: number;
  grossTotalCents: number;
  validUntil: string;
  portalUrl: string;
  personalMessage: string | null;
  contactPhone: string | null;
  replyToEmail: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatGermanDate(value: string): string {
  return new Date(value).toLocaleDateString("de-DE");
}

/**
 * Angebots-Mail als robustes Tabellen-Layout mit Inline-Styles (E-Mail-Clients
 * verstehen modernes CSS unzuverlaessig) + reiner Text-Fallback (wichtig fuer
 * Zustellbarkeit). Alle Nutzereingaben (personalMessage) werden fuer HTML
 * escaped - keine ungefilterte Einbettung.
 */
export function buildQuoteEmailContent(input: QuoteEmailContentInput): { html: string; text: string } {
  const accentColor = input.primaryColor || "#1d4ed8";
  const amount = formatCentsAsEuro(input.grossTotalCents);
  const validUntil = formatGermanDate(input.validUntil);
  const companyNameSafe = escapeHtml(input.companyName);
  const personalMessageHtml = input.personalMessage
    ? `<tr><td style="padding:0 0 20px 0;font-size:15px;line-height:1.5;color:#1a1a1a;">${escapeHtml(input.personalMessage).replace(/\n/g, "<br />")}</td></tr>`
    : "";

  const html = `<!doctype html>
<html lang="de">
  <body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;">
            <tr>
              <td style="padding:24px 32px;border-bottom:1px solid #e5e5e5;">
                ${
                  input.logoUrl
                    ? `<img src="${escapeHtml(input.logoUrl)}" alt="${companyNameSafe}" height="40" style="height:40px;max-width:200px;object-fit:contain;" />`
                    : `<span style="font-size:18px;font-weight:700;color:#1a1a1a;">${companyNameSafe}</span>`
                }
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:0 0 20px 0;font-size:20px;font-weight:700;color:#1a1a1a;">
                      Ihr Angebot #${input.quoteNumber}
                    </td>
                  </tr>
                  ${personalMessageHtml}
                  <tr>
                    <td style="padding:0 0 8px 0;font-size:15px;line-height:1.5;color:#1a1a1a;">
                      ${companyNameSafe} hat Ihnen ein Angebot über <strong>${amount}</strong> erstellt.
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0 0 24px 0;font-size:14px;color:#666666;">
                      Gültig bis ${validUntil}.
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0 0 24px 0;">
                      <a href="${escapeHtml(input.portalUrl)}" style="display:inline-block;background-color:${accentColor};color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:12px 24px;border-radius:6px;">
                        Angebot ansehen
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:20px 0 0 0;border-top:1px solid #e5e5e5;font-size:13px;line-height:1.6;color:#666666;">
                      Mit freundlichen Grüßen<br />
                      ${companyNameSafe}${input.contactPhone ? `<br />Tel. ${escapeHtml(input.contactPhone)}` : ""}<br />
                      ${escapeHtml(input.replyToEmail)}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    `Ihr Angebot #${input.quoteNumber}`,
    "",
    ...(input.personalMessage ? [input.personalMessage, ""] : []),
    `${input.companyName} hat Ihnen ein Angebot über ${amount} erstellt.`,
    `Gültig bis ${validUntil}.`,
    "",
    `Angebot ansehen: ${input.portalUrl}`,
    "",
    "Mit freundlichen Grüßen",
    input.companyName,
    ...(input.contactPhone ? [`Tel. ${input.contactPhone}`] : []),
    input.replyToEmail,
  ].join("\n");

  return { html, text };
}
