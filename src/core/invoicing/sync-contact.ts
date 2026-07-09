import { createClient } from "@/core/supabase/server";
import { decryptSecret } from "@/core/crypto/secret-box";
import { getInvoiceProvider, type IntegrationProviderKey } from "@/core/invoicing";
import type { ContactInput } from "@/core/invoicing/provider";

export type SyncContactResult =
  | { ok: true; externalContactId: string }
  | { ok: false; error: string };

/**
 * Verknuepft einen App-Kunden mit einem sevdesk-Kontakt (Vorbereitung MS 11b).
 * Idempotent ueber die eigene DB: ist sevdesk_contact_id bereits gesetzt, wird
 * kein erneuter sevdesk-Aufruf ausgefuehrt.
 */
export async function syncContactToProvider(
  contactId: string,
  provider: IntegrationProviderKey = "sevdesk",
): Promise<SyncContactResult> {
  const supabase = await createClient();

  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .select(
      "type, company_name, first_name, last_name, email, street, postal_code, city, country, customer_number, sevdesk_contact_id",
    )
    .eq("id", contactId)
    .maybeSingle<ContactInput & { sevdesk_contact_id: string | null }>();

  if (contactError || !contact) {
    return { ok: false, error: "Kontakt konnte nicht geladen werden." };
  }

  if (contact.sevdesk_contact_id) {
    return { ok: true, externalContactId: contact.sevdesk_contact_id };
  }

  const { data: encryptedKey, error: secretError } = await supabase.rpc(
    "get_company_integration_secret",
    { p_provider: provider },
  );

  if (secretError || !encryptedKey) {
    return { ok: false, error: "Keine sevdesk-Verbindung konfiguriert." };
  }

  let apiKey: string;
  try {
    apiKey = decryptSecret(encryptedKey);
  } catch {
    return { ok: false, error: "Server-Konfiguration unvollständig (INTEGRATION_ENCRYPTION_KEY fehlt oder ist ungültig)." };
  }

  const result = await getInvoiceProvider(provider).upsertContact(apiKey, contact, null);

  if (!result.ok) {
    return result;
  }

  const { error: updateError } = await supabase
    .from("contacts")
    .update({ sevdesk_contact_id: result.externalContactId })
    .eq("id", contactId);

  if (updateError) {
    return { ok: false, error: "sevdesk-Kontakt-ID konnte nicht gespeichert werden." };
  }

  return result;
}
