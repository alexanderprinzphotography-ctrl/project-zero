"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/core/supabase/server";
import { getUserContext } from "@/core/auth/get-user-context";
import { qualifiesForAutoRelease } from "@/core/money/quote-math";
import { quoteStatusLabel, type QuoteStatus } from "@/core/quotes/quote";
import { recalculateQuoteTotals } from "@/core/quotes/recalculate";

export type QuoteActionState = { error: string | null };

function nullableTrim(value: FormDataEntryValue | null): string | null {
  const trimmed = String(value ?? "").trim();
  return trimmed === "" ? null : trimmed;
}

function readonlyErrorMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes("row-level security") || lower.includes("gesperrt");
}

function isAdminOrProjektleiter(role: string): boolean {
  return role === "admin" || role === "projektleiter";
}

// "Gesendet" gilt beim Kunden als verbindlich unterwegs - danach werden weder
// Kopfdaten noch Positionen mehr veraendert (siehe core/quotes/quote.ts).
const HEADER_EDITABLE_STATUSES = ["entwurf", "zur_freigabe", "freigegeben"];

type ParsedQuoteHeader = {
  customer_id: string;
  project_id: string | null;
  quote_date: string;
  valid_until: string;
  tax_rate: number;
  intro_text: string | null;
  closing_text: string | null;
};

function parseQuoteHeaderForm(formData: FormData): {
  error: string | null;
  input: ParsedQuoteHeader | null;
} {
  const customerId = nullableTrim(formData.get("customerId"));
  const projectId = nullableTrim(formData.get("projectId"));
  const quoteDate = nullableTrim(formData.get("quoteDate"));
  const validUntil = nullableTrim(formData.get("validUntil"));
  const taxRateRaw = nullableTrim(formData.get("taxRate"));

  if (!customerId) return { error: "Bitte einen Kunden wählen.", input: null };
  if (!quoteDate) return { error: "Bitte ein Angebotsdatum angeben.", input: null };
  if (!validUntil) return { error: "Bitte ein Gültig-bis-Datum angeben.", input: null };

  const taxRate = Number(taxRateRaw ?? "19");
  if (!Number.isInteger(taxRate) || taxRate < 0) {
    return { error: "Ungültiger Steuersatz.", input: null };
  }

  return {
    error: null,
    input: {
      customer_id: customerId,
      project_id: projectId,
      quote_date: quoteDate,
      valid_until: validUntil,
      tax_rate: taxRate,
      intro_text: nullableTrim(formData.get("introText")),
      closing_text: nullableTrim(formData.get("closingText")),
    },
  };
}

export async function createQuote(
  _prevState: QuoteActionState,
  formData: FormData,
): Promise<QuoteActionState> {
  const context = await getUserContext();
  if (!context || !isAdminOrProjektleiter(context.role)) {
    return { error: "Nur Admin oder Projektleiter können Angebote anlegen." };
  }
  if (!context.isWritable) {
    return { error: "Testphase abgelaufen – Anlegen ist gesperrt." };
  }

  const { error: validationError, input } = parseQuoteHeaderForm(formData);
  if (validationError || !input) {
    return { error: validationError };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("quotes").insert(input).select("id").single();

  if (error) {
    if (readonlyErrorMessage(error.message)) {
      return { error: "Testphase abgelaufen – Anlegen ist gesperrt." };
    }
    return { error: "Angebot konnte nicht angelegt werden." };
  }

  revalidatePath("/angebote");
  redirect(`/angebote/${data.id}`);
}

export async function updateQuote(
  id: string,
  _prevState: QuoteActionState,
  formData: FormData,
): Promise<QuoteActionState> {
  const context = await getUserContext();
  if (!context || !isAdminOrProjektleiter(context.role)) {
    return { error: "Nur Admin oder Projektleiter können Angebote bearbeiten." };
  }
  if (!context.isWritable) {
    return { error: "Testphase abgelaufen – Bearbeiten ist gesperrt." };
  }

  const { error: validationError, input } = parseQuoteHeaderForm(formData);
  if (validationError || !input) {
    return { error: validationError };
  }

  const supabase = await createClient();
  const { data: current } = await supabase.from("quotes").select("status").eq("id", id).maybeSingle();
  if (!current) return { error: "Angebot nicht gefunden." };
  if (!HEADER_EDITABLE_STATUSES.includes(current.status)) {
    return { error: `Ein Angebot im Status „${quoteStatusLabel(current.status)}“ kann nicht mehr bearbeitet werden.` };
  }

  const { error } = await supabase.from("quotes").update(input).eq("id", id);
  if (error) {
    if (readonlyErrorMessage(error.message)) {
      return { error: "Testphase abgelaufen – Bearbeiten ist gesperrt." };
    }
    return { error: "Angebot konnte nicht gespeichert werden." };
  }

  // Der Steuersatz kann sich hier geaendert haben - Summen neu berechnen.
  // Entzieht als Nebeneffekt auch die Freigabe, falls das Angebot bereits
  // freigegeben war (siehe recalculateQuoteTotals).
  await recalculateQuoteTotals(supabase, id);

  revalidatePath("/angebote");
  revalidatePath(`/angebote/${id}`);
  redirect(`/angebote/${id}`);
}

export async function deleteQuote(
  _prevState: QuoteActionState,
  formData: FormData,
): Promise<QuoteActionState> {
  const context = await getUserContext();
  if (!context || !isAdminOrProjektleiter(context.role)) {
    return { error: "Nur Admin oder Projektleiter können Angebote löschen." };
  }

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Ungültiges Angebot." };

  const supabase = await createClient();
  const { data: current } = await supabase.from("quotes").select("status").eq("id", id).maybeSingle();
  if (!current) return { error: "Angebot nicht gefunden." };
  if (current.status !== "entwurf") {
    return { error: "Nur Angebote im Entwurf können gelöscht werden." };
  }

  const { error } = await supabase.from("quotes").delete().eq("id", id);
  if (error) {
    if (readonlyErrorMessage(error.message)) {
      return { error: "Testphase abgelaufen – Löschen ist gesperrt." };
    }
    return { error: "Angebot konnte nicht gelöscht werden." };
  }

  revalidatePath("/angebote");
  redirect("/angebote");
}

// ---------------------------------------------------------------------------
// Statusaktionen
// ---------------------------------------------------------------------------

const SIMPLE_TRANSITIONS: Partial<Record<QuoteStatus, QuoteStatus[]>> = {
  gesendet: ["angenommen", "abgelehnt"],
  freigegeben: ["gesendet"],
};

/** Reicht ein Angebot zur Freigabe ein - greift die Auto-Freigabe-Grenze, wird direkt freigegeben (siehe MS 8c). */
export async function submitQuoteForApproval(
  _prevState: QuoteActionState,
  formData: FormData,
): Promise<QuoteActionState> {
  const context = await getUserContext();
  if (!context || !isAdminOrProjektleiter(context.role)) {
    return { error: "Nur Admin oder Projektleiter können Angebote einreichen." };
  }
  if (!context.isWritable) {
    return { error: "Testphase abgelaufen – Aktion ist gesperrt." };
  }

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Ungültiges Angebot." };

  const supabase = await createClient();
  const { data: quote } = await supabase
    .from("quotes")
    .select("status, gross_total_cents, company_id")
    .eq("id", id)
    .maybeSingle();
  if (!quote) return { error: "Angebot nicht gefunden." };
  if (!["entwurf", "zur_freigabe"].includes(quote.status)) {
    return { error: `Angebot im Status „${quoteStatusLabel(quote.status)}“ kann nicht eingereicht werden.` };
  }

  const { data: company } = await supabase
    .from("companies")
    .select("auto_release_enabled, auto_release_limit_cents")
    .eq("id", quote.company_id)
    .single();
  if (!company) return { error: "Firmeneinstellungen nicht gefunden." };

  const autoRelease = qualifiesForAutoRelease(quote.gross_total_cents, {
    autoReleaseEnabled: company.auto_release_enabled,
    autoReleaseLimitCents: company.auto_release_limit_cents,
  });

  const update = autoRelease
    ? { status: "freigegeben" as const, approved_by: null, approved_at: new Date().toISOString() }
    : { status: "zur_freigabe" as const };

  const { error } = await supabase.from("quotes").update(update).eq("id", id);
  if (error) {
    if (readonlyErrorMessage(error.message)) {
      return { error: "Testphase abgelaufen – Aktion ist gesperrt." };
    }
    return { error: "Aktion fehlgeschlagen." };
  }

  revalidatePath("/angebote");
  revalidatePath(`/angebote/${id}`);
  return { error: null };
}

/** Manuelle Freigabe durch admin/projektleiter. */
export async function approveQuote(
  _prevState: QuoteActionState,
  formData: FormData,
): Promise<QuoteActionState> {
  const context = await getUserContext();
  if (!context || !isAdminOrProjektleiter(context.role)) {
    return { error: "Nur Admin oder Projektleiter können Angebote freigeben." };
  }
  if (!context.isWritable) {
    return { error: "Testphase abgelaufen – Freigeben ist gesperrt." };
  }

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Ungültiges Angebot." };

  const supabase = await createClient();
  const { data: quote } = await supabase.from("quotes").select("status").eq("id", id).maybeSingle();
  if (!quote) return { error: "Angebot nicht gefunden." };
  if (!["entwurf", "zur_freigabe"].includes(quote.status)) {
    return { error: `Angebot im Status „${quoteStatusLabel(quote.status)}“ kann nicht freigegeben werden.` };
  }

  const { error } = await supabase
    .from("quotes")
    .update({ status: "freigegeben", approved_by: context.userId, approved_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    if (readonlyErrorMessage(error.message)) {
      return { error: "Testphase abgelaufen – Freigeben ist gesperrt." };
    }
    return { error: "Freigabe fehlgeschlagen." };
  }

  revalidatePath("/angebote");
  revalidatePath(`/angebote/${id}`);
  return { error: null };
}

export async function setQuoteStatus(
  _prevState: QuoteActionState,
  formData: FormData,
): Promise<QuoteActionState> {
  const context = await getUserContext();
  if (!context || !isAdminOrProjektleiter(context.role)) {
    return { error: "Nur Admin oder Projektleiter können den Status ändern." };
  }
  if (!context.isWritable) {
    return { error: "Testphase abgelaufen – Aktion ist gesperrt." };
  }

  const id = String(formData.get("id") ?? "");
  const targetStatus = String(formData.get("targetStatus") ?? "") as QuoteStatus;
  if (!id || !targetStatus) return { error: "Ungültige Aktion." };

  const supabase = await createClient();
  const { data: quote } = await supabase.from("quotes").select("status").eq("id", id).maybeSingle();
  if (!quote) return { error: "Angebot nicht gefunden." };

  const allowed = SIMPLE_TRANSITIONS[quote.status as QuoteStatus] ?? [];
  if (!allowed.includes(targetStatus)) {
    return {
      error: `Übergang von „${quoteStatusLabel(quote.status)}“ zu „${quoteStatusLabel(targetStatus)}“ ist nicht möglich.`,
    };
  }

  const { error } = await supabase.from("quotes").update({ status: targetStatus }).eq("id", id);
  if (error) {
    if (readonlyErrorMessage(error.message)) {
      return { error: "Testphase abgelaufen – Aktion ist gesperrt." };
    }
    return { error: "Aktion fehlgeschlagen." };
  }

  revalidatePath("/angebote");
  revalidatePath(`/angebote/${id}`);
  return { error: null };
}
