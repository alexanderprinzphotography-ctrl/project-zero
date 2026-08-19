import type { EmailProvider, SendEmailResult, SendTransactionalInput } from "./provider";

/**
 * Brevo-Anbindung (MS 12b). Ausschliesslich serverseitig verwenden - der
 * API-Key darf den Server nie verlassen und wird hier nie geloggt. Sender-
 * Adresse kommt aus BREVO_SENDER_EMAIL (Plattform-Domain, siehe Leitprinzip:
 * Versand ueber Kunden-Domains wuerde SPF/DKIM pro Firma erfordern).
 */

const BASE_URL = "https://api.brevo.com/v3";
const TIMEOUT_MS = 10_000;

async function extractBrevoErrorDetail(res: Response): Promise<string | null> {
  try {
    const text = await res.text();
    if (!text) return null;
    try {
      const parsed = JSON.parse(text) as { message?: string; code?: string };
      return parsed.message ?? parsed.code ?? text.slice(0, 500);
    } catch {
      return text.slice(0, 500);
    }
  } catch {
    return null;
  }
}

export class BrevoProvider implements EmailProvider {
  async sendTransactional(input: SendTransactionalInput): Promise<SendEmailResult> {
    const apiKey = process.env.BREVO_API_KEY;
    const senderEmail = process.env.BREVO_SENDER_EMAIL;
    if (!apiKey || !senderEmail) {
      return { ok: false, error: "E-Mail-Versand ist serverseitig nicht konfiguriert." };
    }

    const payload = {
      sender: { email: senderEmail, name: input.senderName },
      to: [{ email: input.to.email, name: input.to.name }],
      replyTo: { email: input.replyTo.email, name: input.replyTo.name },
      subject: input.subject,
      htmlContent: input.html,
      textContent: input.text,
    };

    let res: Response;
    try {
      res = await fetch(`${BASE_URL}/smtp/email`, {
        method: "POST",
        headers: { "api-key": apiKey, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      if (err instanceof Error && err.name === "TimeoutError") {
        return { ok: false, error: "Zeitüberschreitung beim Senden der E-Mail." };
      }
      return { ok: false, error: "Verbindung zum E-Mail-Anbieter fehlgeschlagen." };
    }

    if (res.status === 401 || res.status === 403) {
      return { ok: false, error: "E-Mail-Versand ist serverseitig falsch konfiguriert (Zugriff verweigert)." };
    }
    if (!res.ok) {
      const detail = await extractBrevoErrorDetail(res);
      return {
        ok: false,
        error: `E-Mail konnte nicht gesendet werden${detail ? `: ${detail}` : ` (Status ${res.status})`}.`,
      };
    }

    const data = (await res.json()) as { messageId?: string };
    if (!data.messageId) {
      return { ok: false, error: "Anbieter-Antwort enthielt keine Nachrichten-ID." };
    }
    return { ok: true, messageId: data.messageId };
  }
}
