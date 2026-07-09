import { createClient } from "@/core/supabase/server";
import { decryptSecret } from "@/core/crypto/secret-box";
import { getInvoiceProvider } from "@/core/invoicing";
import { syncContactToProvider } from "@/core/invoicing/sync-contact";
import { contactDisplayName } from "@/core/crm/contact";
import type { InvoicePosition, MirroredInvoiceStatus } from "@/core/invoicing/provider";

/** sevdesk übernimmt die Anschrift nicht automatisch vom Kontakt - die Rechnung braucht eine eigene, mehrzeilige Anschrift. */
function formatCustomerAddress(contact: {
  type: "privat" | "gewerblich";
  company_name: string | null;
  first_name: string | null;
  last_name: string | null;
  street: string | null;
  postal_code: string | null;
  city: string | null;
  country: string;
}): string {
  const lines = [
    contactDisplayName(contact),
    contact.street,
    [contact.postal_code, contact.city].filter(Boolean).join(" "),
    contact.country === "DE" ? "Deutschland" : contact.country,
  ].filter((line) => line && line.trim() !== "");
  return lines.join("\n");
}

export type CreateInvoiceForQuoteResult =
  | { ok: true; invoiceId: string; alreadyExisted: boolean }
  | { ok: false; error: string };

/**
 * Erstellt genau eine sevdesk-Rechnung aus einem angenommenen Angebot.
 * Mehrschichtige Idempotenz (siehe MS 11b): eigene DB zuerst (Schicht 1,
 * schneller Pfad), sevdesk-seitige Suche per Referenz-Marker vor dem
 * Erstellen (Schicht 2, faengt Teilausfaelle ab - z. B. Timeout NACH
 * erfolgreichem sevdesk-Call aber VOR dem eigenen DB-Schreiben), UNIQUE-
 * Constraint auf invoices.quote_id (Schicht 3, DB-seitiges Sicherheitsnetz
 * gegen jede verbliebene Race Condition).
 */
export async function createInvoiceForQuote(quoteId: string): Promise<CreateInvoiceForQuoteResult> {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("invoices")
    .select("id")
    .eq("quote_id", quoteId)
    .maybeSingle();
  if (existing) {
    return { ok: true, invoiceId: existing.id, alreadyExisted: true };
  }

  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .select("id, quote_number, status, customer_id, tax_rate, net_total_cents, gross_total_cents, quote_date")
    .eq("id", quoteId)
    .maybeSingle();
  if (quoteError || !quote) {
    return { ok: false, error: "Angebot nicht gefunden." };
  }
  if (quote.status !== "angenommen") {
    return { ok: false, error: "Nur angenommene Angebote können in Rechnungen umgewandelt werden." };
  }

  const { data: integration } = await supabase
    .from("company_integrations")
    .select("status")
    .eq("provider", "sevdesk")
    .maybeSingle();
  if (!integration) {
    return {
      ok: false,
      error: "Keine sevdesk-Verbindung eingerichtet. Bitte zuerst in den Einstellungen verbinden.",
    };
  }

  const { data: encryptedKey, error: secretError } = await supabase.rpc("get_company_integration_secret", {
    p_provider: "sevdesk",
  });
  if (secretError || !encryptedKey) {
    return { ok: false, error: "sevdesk-Verbindung konnte nicht gelesen werden." };
  }

  let apiKey: string;
  try {
    apiKey = decryptSecret(encryptedKey);
  } catch {
    return {
      ok: false,
      error: "Server-Konfiguration unvollständig (INTEGRATION_ENCRYPTION_KEY fehlt oder ist ungültig).",
    };
  }

  const contactSync = await syncContactToProvider(quote.customer_id, "sevdesk");
  if (!contactSync.ok) {
    return { ok: false, error: contactSync.error };
  }

  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .select("type, company_name, first_name, last_name, street, postal_code, city, country")
    .eq("id", quote.customer_id)
    .maybeSingle();
  if (contactError || !contact) {
    return { ok: false, error: "Kunde konnte nicht geladen werden." };
  }
  const customerAddressText = formatCustomerAddress(contact);

  const provider = getInvoiceProvider("sevdesk");
  const referenceMarker = `Angebot #${quote.quote_number}`;

  const existingExternalId = await provider.findInvoiceByReference(
    apiKey,
    contactSync.externalContactId,
    referenceMarker,
  );

  let created: {
    ok: true;
    externalInvoiceId: string;
    invoiceNumber: string;
    status: MirroredInvoiceStatus;
    invoiceDate: string;
    dueDate: string | null;
  };

  if (existingExternalId) {
    const status = await provider.getInvoiceStatus(apiKey, existingExternalId);
    if (!status.ok) return { ok: false, error: status.error };
    created = {
      ok: true,
      externalInvoiceId: existingExternalId,
      invoiceNumber: status.invoiceNumber,
      status: status.status,
      invoiceDate: quote.quote_date,
      dueDate: status.dueDate,
    };
  } else {
    const { data: itemRows, error: itemsError } = await supabase
      .from("quote_items")
      .select("name, unit, quantity, unit_price_net_cents")
      .eq("quote_id", quoteId)
      .order("position", { ascending: true });
    if (itemsError || !itemRows || itemRows.length === 0) {
      return { ok: false, error: "Angebot hat keine Positionen." };
    }

    const positions: InvoicePosition[] = itemRows.map((item) => ({
      name: item.name,
      quantity: Number(item.quantity),
      unitLabel: item.unit,
      unitPriceNetCents: item.unit_price_net_cents,
      taxRatePercent: quote.tax_rate,
    }));

    const result = await provider.createInvoice(apiKey, {
      externalContactId: contactSync.externalContactId,
      referenceHeader: referenceMarker,
      invoiceDate: quote.quote_date,
      customerAddressText,
      positions,
    });
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    created = result;
  }

  const { data: inserted, error: insertError } = await supabase
    .from("invoices")
    .insert({
      quote_id: quoteId,
      contact_id: quote.customer_id,
      provider: "sevdesk",
      provider_invoice_id: created.externalInvoiceId,
      provider_invoice_number: created.invoiceNumber,
      status: created.status,
      gross_total_cents: quote.gross_total_cents,
      net_total_cents: quote.net_total_cents,
      invoice_date: created.invoiceDate,
      due_date: created.dueDate,
    })
    .select("id")
    .single();

  if (insertError) {
    // Unique-Constraint-Verletzung = ein paralleler Request war schneller (Race Condition) - kein Fehler.
    if (insertError.code === "23505") {
      const { data: raceWinner } = await supabase
        .from("invoices")
        .select("id")
        .eq("quote_id", quoteId)
        .maybeSingle();
      if (raceWinner) return { ok: true, invoiceId: raceWinner.id, alreadyExisted: true };
    }
    return {
      ok: false,
      error: `Rechnung wurde in sevdesk angelegt (Nr. ${created.invoiceNumber}), konnte aber nicht gespeichert werden. Bitte sevdesk und Support prüfen.`,
    };
  }

  return { ok: true, invoiceId: inserted.id, alreadyExisted: false };
}
