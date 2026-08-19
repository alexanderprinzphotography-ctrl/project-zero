/**
 * Abstraktion ueber Transaktions-E-Mail-Anbieter (MS 12b). Die App spricht
 * NIE direkt mit einem konkreten Anbieter (aktuell Brevo), sondern nur ueber
 * dieses Interface - ein Anbieterwechsel bleibt so moeglich. Nur transaktionale
 * Einzel-Mails (kein Massenversand/Newsletter).
 */

export type EmailAddress = { email: string; name?: string };

export type SendTransactionalInput = {
  to: EmailAddress;
  replyTo: EmailAddress;
  senderName: string;
  subject: string;
  html: string;
  text: string;
};

export type SendEmailResult = { ok: true; messageId: string } | { ok: false; error: string };

// Anders als InvoiceProvider (sevdesk, EIN Key pro Firma) ist der Mail-Versand
// ein Plattform-weites Konto (EIN Brevo-Account fuer alle Firmen) - der Key
// kommt daher intern aus der Env, nicht als Parameter vom Aufrufer (analog
// getStripeClient(), nicht analog dem sevdesk-Provider).
export interface EmailProvider {
  sendTransactional(input: SendTransactionalInput): Promise<SendEmailResult>;
}
