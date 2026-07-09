import { NextResponse } from "next/server";
import { createClient } from "@/core/supabase/server";
import { getUserContext } from "@/core/auth/get-user-context";
import { decryptSecret } from "@/core/crypto/secret-box";
import { getInvoiceProvider, type IntegrationProviderKey } from "@/core/invoicing";

/**
 * Proxy fuer das sevdesk-Rechnungs-PDF - kein eigenes Rendern, nur Weiterreichen
 * dessen, was sevdesk als GoBD-konformes Original liefert (Leitprinzip MS 11).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await getUserContext();
  if (!context || !["admin", "projektleiter"].includes(context.role)) {
    return new NextResponse("Nicht berechtigt", { status: 403 });
  }

  const supabase = await createClient();
  const { data: invoice } = await supabase
    .from("invoices")
    .select("provider, provider_invoice_id, provider_invoice_number")
    .eq("id", id)
    .maybeSingle();

  if (!invoice) {
    return new NextResponse("Rechnung nicht gefunden", { status: 404 });
  }

  const provider = invoice.provider as IntegrationProviderKey;

  const { data: encryptedKey, error: secretError } = await supabase.rpc("get_company_integration_secret", {
    p_provider: provider,
  });
  if (secretError || !encryptedKey) {
    return new NextResponse("sevdesk-Verbindung konnte nicht gelesen werden", { status: 502 });
  }

  let apiKey: string;
  try {
    apiKey = decryptSecret(encryptedKey);
  } catch {
    return new NextResponse("Server-Konfiguration unvollständig", { status: 500 });
  }

  const result = await getInvoiceProvider(provider).getInvoicePdf(apiKey, invoice.provider_invoice_id);
  if (!result.ok) {
    return new NextResponse(result.error, { status: 502 });
  }

  const pdfBuffer = Buffer.from(result.pdfBase64, "base64");

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Rechnung-${invoice.provider_invoice_number}.pdf"`,
    },
  });
}
