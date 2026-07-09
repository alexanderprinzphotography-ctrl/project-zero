"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/core/supabase/server";
import { getUserContext } from "@/core/auth/get-user-context";
import { decryptSecret } from "@/core/crypto/secret-box";
import { getInvoiceProvider, type IntegrationProviderKey } from "@/core/invoicing";

export type RefreshInvoiceStatusState = { error: string | null; success: string | null };

export async function refreshInvoiceStatus(
  _prevState: RefreshInvoiceStatusState,
  formData: FormData,
): Promise<RefreshInvoiceStatusState> {
  const context = await getUserContext();
  if (!context || !["admin", "projektleiter"].includes(context.role)) {
    return { error: "Keine Berechtigung.", success: null };
  }

  const invoiceId = String(formData.get("invoiceId") ?? "");
  if (!invoiceId) return { error: "Ungültige Rechnung.", success: null };

  const supabase = await createClient();
  const { data: invoice } = await supabase
    .from("invoices")
    .select("id, provider, provider_invoice_id")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!invoice) return { error: "Rechnung nicht gefunden.", success: null };

  const provider = invoice.provider as IntegrationProviderKey;

  const { data: encryptedKey, error: secretError } = await supabase.rpc("get_company_integration_secret", {
    p_provider: provider,
  });
  if (secretError || !encryptedKey) {
    return { error: "sevdesk-Verbindung konnte nicht gelesen werden.", success: null };
  }

  let apiKey: string;
  try {
    apiKey = decryptSecret(encryptedKey);
  } catch {
    return {
      error: "Server-Konfiguration unvollständig (INTEGRATION_ENCRYPTION_KEY fehlt oder ist ungültig).",
      success: null,
    };
  }

  const status = await getInvoiceProvider(provider).getInvoiceStatus(apiKey, invoice.provider_invoice_id);
  if (!status.ok) {
    return { error: status.error, success: null };
  }

  const { error: updateError } = await supabase
    .from("invoices")
    .update({ status: status.status, due_date: status.dueDate, last_synced_at: new Date().toISOString() })
    .eq("id", invoiceId);
  if (updateError) {
    return { error: "Status konnte nicht gespeichert werden.", success: null };
  }

  revalidatePath("/rechnungen");
  return { error: null, success: "Status aktualisiert." };
}
