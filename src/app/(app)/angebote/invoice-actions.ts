"use server";

import { revalidatePath } from "next/cache";
import { getUserContext } from "@/core/auth/get-user-context";
import { createInvoiceForQuote } from "@/core/invoicing/create-invoice";

export type InvoiceActionState = { error: string | null; success: string | null };

function isAdminOrProjektleiter(role: string): boolean {
  return role === "admin" || role === "projektleiter";
}

export async function createInvoiceAction(
  _prevState: InvoiceActionState,
  formData: FormData,
): Promise<InvoiceActionState> {
  const context = await getUserContext();
  if (!context || !isAdminOrProjektleiter(context.role)) {
    return { error: "Nur Admin oder Projektleiter können Rechnungen erstellen.", success: null };
  }
  if (!context.isWritable) {
    return { error: "Testphase abgelaufen – Aktion ist gesperrt.", success: null };
  }

  const quoteId = String(formData.get("quoteId") ?? "");
  if (!quoteId) return { error: "Ungültiges Angebot.", success: null };

  const result = await createInvoiceForQuote(quoteId);
  if (!result.ok) {
    return { error: result.error, success: null };
  }

  revalidatePath(`/angebote/${quoteId}`);
  revalidatePath("/rechnungen");

  return {
    error: null,
    success: result.alreadyExisted ? "Für dieses Angebot existiert bereits eine Rechnung." : "Rechnung erstellt.",
  };
}
