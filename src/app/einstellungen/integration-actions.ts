"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/core/supabase/server";
import { getUserContext } from "@/core/auth/get-user-context";
import { encryptSecret, decryptSecret } from "@/core/crypto/secret-box";
import { getInvoiceProvider } from "@/core/invoicing";

export type IntegrationActionState = { error: string | null; success: string | null };

const PROVIDER = "sevdesk" as const;

export async function saveAndTestIntegration(
  _prevState: IntegrationActionState,
  formData: FormData,
): Promise<IntegrationActionState> {
  const context = await getUserContext();
  if (!context || context.role !== "admin") {
    return { error: "Nur Admins können die Buchhaltungs-Verbindung ändern.", success: null };
  }
  if (!context.isWritable) {
    return { error: "Testphase abgelaufen – Änderungen sind gesperrt.", success: null };
  }

  const apiKey = String(formData.get("apiKey") ?? "").trim();
  if (!apiKey) {
    return { error: "Bitte einen API-Schlüssel angeben.", success: null };
  }

  const result = await getInvoiceProvider(PROVIDER).testConnection(apiKey);
  if (!result.ok) {
    return { error: result.error, success: null };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("upsert_company_integration", {
    p_provider: PROVIDER,
    p_api_key_encrypted: encryptSecret(apiKey),
    p_key_last4: apiKey.slice(-4),
  });

  if (error) {
    return { error: "Verbindung wurde getestet, konnte aber nicht gespeichert werden.", success: null };
  }

  revalidatePath("/einstellungen");
  return { error: null, success: "sevdesk-Verbindung hergestellt." };
}

export async function retestIntegration(
  _prevState: IntegrationActionState,
  _formData: FormData,
): Promise<IntegrationActionState> {
  const context = await getUserContext();
  if (!context || context.role !== "admin") {
    return { error: "Nur Admins können die Verbindung testen.", success: null };
  }

  const supabase = await createClient();
  const { data: encryptedKey, error: secretError } = await supabase.rpc(
    "get_company_integration_secret",
    { p_provider: PROVIDER },
  );

  if (secretError || !encryptedKey) {
    return { error: "Keine sevdesk-Verbindung konfiguriert.", success: null };
  }

  const apiKey = decryptSecret(encryptedKey);
  const result = await getInvoiceProvider(PROVIDER).testConnection(apiKey);

  await supabase.rpc("set_company_integration_status", {
    p_provider: PROVIDER,
    p_status: result.ok ? "ok" : "error",
    p_last_error: result.ok ? null : result.error,
  });

  revalidatePath("/einstellungen");

  if (!result.ok) {
    return { error: result.error, success: null };
  }
  return { error: null, success: "Verbindung erfolgreich getestet." };
}

export async function disconnectIntegration(
  _prevState: IntegrationActionState,
  _formData: FormData,
): Promise<IntegrationActionState> {
  const context = await getUserContext();
  if (!context || context.role !== "admin") {
    return { error: "Nur Admins können die Verbindung trennen.", success: null };
  }
  if (!context.isWritable) {
    return { error: "Testphase abgelaufen – Änderungen sind gesperrt.", success: null };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("company_integrations")
    .delete()
    .eq("provider", PROVIDER);

  if (error) {
    return { error: "Verbindung konnte nicht getrennt werden.", success: null };
  }

  revalidatePath("/einstellungen");
  return { error: null, success: "sevdesk-Verbindung getrennt." };
}
