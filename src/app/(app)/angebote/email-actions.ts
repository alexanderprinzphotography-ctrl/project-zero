"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/core/supabase/server";
import { getUserContext } from "@/core/auth/get-user-context";
import { contactDisplayName } from "@/core/crm/contact";
import { getEmailProvider } from "@/core/email";
import { buildQuoteEmailContent } from "@/core/email/quote-email-template";
import { ensureShareLink } from "./share-link-actions";

export type SendEmailActionState = { error: string | null; success: boolean };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isAdminOrProjektleiter(role: string): boolean {
  return role === "admin" || role === "projektleiter";
}

export async function sendQuoteEmail(
  quoteId: string,
  _prevState: SendEmailActionState,
  formData: FormData,
): Promise<SendEmailActionState> {
  const context = await getUserContext();
  if (!context || !isAdminOrProjektleiter(context.role)) {
    return { error: "Nur Admin oder Projektleiter können Angebote per E-Mail versenden.", success: false };
  }
  if (!context.isWritable) {
    return { error: "Testphase abgelaufen – Versand ist gesperrt.", success: false };
  }

  const recipientEmail = String(formData.get("recipientEmail") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const personalMessage = String(formData.get("personalMessage") ?? "").trim() || null;

  if (!recipientEmail || !EMAIL_RE.test(recipientEmail)) {
    return { error: "Bitte eine gültige Empfänger-E-Mail-Adresse angeben.", success: false };
  }
  if (!subject) {
    return { error: "Bitte einen Betreff angeben.", success: false };
  }

  const supabase = await createClient();

  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .select(
      "id, quote_number, status, valid_until, gross_total_cents, customer_id, contacts(type, company_name, first_name, last_name)",
    )
    .eq("id", quoteId)
    .maybeSingle<{
      id: string;
      quote_number: number;
      status: string;
      valid_until: string;
      gross_total_cents: number;
      customer_id: string;
      contacts: {
        type: "privat" | "gewerblich";
        company_name: string | null;
        first_name: string | null;
        last_name: string | null;
      } | null;
    }>();

  if (quoteError || !quote) {
    return { error: "Angebot nicht gefunden.", success: false };
  }
  if (!["freigegeben", "gesendet"].includes(quote.status)) {
    return { error: "Nur freigegebene oder bereits gesendete Angebote können versendet werden.", success: false };
  }

  const replyToEmail = EMAIL_RE.test(context.replyToEmail ?? "") ? context.replyToEmail! : context.email;
  if (!EMAIL_RE.test(replyToEmail)) {
    return {
      error: "Keine gültige Antwort-E-Mail hinterlegt. Bitte in den Einstellungen eintragen.",
      success: false,
    };
  }

  const linkResult = await ensureShareLink(quoteId);
  if (!linkResult.ok) {
    return { error: linkResult.error, success: false };
  }

  const h = await headers();
  const origin = h.get("origin") ?? `https://${h.get("host")}`;
  const portalUrl = `${origin}/angebot/${linkResult.token}`;

  const { html, text } = buildQuoteEmailContent({
    companyName: context.companyName,
    logoUrl: context.logoUrl,
    primaryColor: context.primaryColor,
    quoteNumber: quote.quote_number,
    grossTotalCents: quote.gross_total_cents,
    validUntil: quote.valid_until,
    portalUrl,
    personalMessage,
    contactPhone: context.contactPhone,
    replyToEmail,
  });

  const recipientName = quote.contacts ? contactDisplayName(quote.contacts) : undefined;

  const result = await getEmailProvider().sendTransactional({
    to: { email: recipientEmail, name: recipientName },
    replyTo: { email: replyToEmail, name: context.companyName },
    senderName: `${context.companyName} (via Baustellen-Zentrale)`,
    subject,
    html,
    text,
  });

  if (!result.ok) {
    await logEmailAttempt(supabase, {
      quoteId,
      toEmail: recipientEmail,
      subject,
      status: "fehler",
      errorMessage: result.error,
    });
    return { error: result.error, success: false };
  }

  await logEmailAttempt(supabase, {
    quoteId,
    toEmail: recipientEmail,
    subject,
    status: "gesendet",
    providerMessageId: result.messageId,
  });

  if (quote.status === "freigegeben") {
    await supabase.from("quotes").update({ status: "gesendet" }).eq("id", quoteId);
  }

  revalidatePath(`/angebote/${quoteId}`);
  return { error: null, success: true };
}

async function logEmailAttempt(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: {
    quoteId: string;
    toEmail: string;
    subject: string;
    status: "gesendet" | "fehler";
    providerMessageId?: string;
    errorMessage?: string;
  },
): Promise<void> {
  await supabase.from("email_log").insert({
    quote_id: input.quoteId,
    to_email: input.toEmail,
    subject: input.subject,
    status: input.status,
    provider_message_id: input.providerMessageId ?? null,
    error_message: input.errorMessage ?? null,
  });
}
