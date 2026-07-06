"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/core/supabase/server";
import { getUserContext } from "@/core/auth/get-user-context";
import type { ContactType } from "@/core/crm/contact";

export type ContactActionState = { error: string | null };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function nullableTrim(value: FormDataEntryValue | null): string | null {
  const trimmed = String(value ?? "").trim();
  return trimmed === "" ? null : trimmed;
}

function readonlyErrorMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes("row-level security") || lower.includes("gesperrt");
}

type ParsedContactInput = {
  type: ContactType;
  company_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  street: string | null;
  postal_code: string | null;
  city: string | null;
  country: string;
  vat_id: string | null;
  notes: string | null;
};

function parseAndValidate(formData: FormData): { error: string | null; input: ParsedContactInput | null } {
  const type = formData.get("type") === "gewerblich" ? "gewerblich" : "privat";
  const companyName = nullableTrim(formData.get("companyName"));
  const firstName = nullableTrim(formData.get("firstName"));
  const lastName = nullableTrim(formData.get("lastName"));
  const email = nullableTrim(formData.get("email"));

  if (!companyName && !firstName && !lastName) {
    return { error: "Bitte mindestens einen Namen angeben (Firma oder Person).", input: null };
  }
  if (email && !EMAIL_RE.test(email)) {
    return { error: "Bitte eine gültige E-Mail-Adresse angeben.", input: null };
  }

  return {
    error: null,
    input: {
      type,
      company_name: companyName,
      first_name: firstName,
      last_name: lastName,
      email,
      phone: nullableTrim(formData.get("phone")),
      mobile: nullableTrim(formData.get("mobile")),
      street: nullableTrim(formData.get("street")),
      postal_code: nullableTrim(formData.get("postalCode")),
      city: nullableTrim(formData.get("city")),
      country: nullableTrim(formData.get("country")) ?? "DE",
      vat_id: nullableTrim(formData.get("vatId")),
      notes: nullableTrim(formData.get("notes")),
    },
  };
}

export async function createContact(
  _prevState: ContactActionState,
  formData: FormData,
): Promise<ContactActionState> {
  const context = await getUserContext();
  if (!context || !["admin", "projektleiter"].includes(context.role)) {
    return { error: "Nur Admin oder Projektleiter können Kunden anlegen." };
  }
  if (!context.isWritable) {
    return { error: "Testphase abgelaufen – Anlegen ist gesperrt." };
  }

  const { error: validationError, input } = parseAndValidate(formData);
  if (validationError || !input) {
    return { error: validationError };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("contacts").insert(input).select("id").single();

  if (error) {
    if (readonlyErrorMessage(error.message)) {
      return { error: "Testphase abgelaufen – Anlegen ist gesperrt." };
    }
    return { error: "Kunde konnte nicht angelegt werden." };
  }

  revalidatePath("/kunden");
  redirect(`/kunden/${data.id}`);
}

export async function updateContact(
  id: string,
  _prevState: ContactActionState,
  formData: FormData,
): Promise<ContactActionState> {
  const context = await getUserContext();
  if (!context || !["admin", "projektleiter"].includes(context.role)) {
    return { error: "Nur Admin oder Projektleiter können Kunden bearbeiten." };
  }
  if (!context.isWritable) {
    return { error: "Testphase abgelaufen – Bearbeiten ist gesperrt." };
  }

  const { error: validationError, input } = parseAndValidate(formData);
  if (validationError || !input) {
    return { error: validationError };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("contacts").update(input).eq("id", id);

  if (error) {
    if (readonlyErrorMessage(error.message)) {
      return { error: "Testphase abgelaufen – Bearbeiten ist gesperrt." };
    }
    return { error: "Kunde konnte nicht gespeichert werden." };
  }

  revalidatePath("/kunden");
  revalidatePath(`/kunden/${id}`);
  redirect(`/kunden/${id}`);
}

export async function setContactArchived(
  _prevState: ContactActionState,
  formData: FormData,
): Promise<ContactActionState> {
  const context = await getUserContext();
  if (!context || !["admin", "projektleiter"].includes(context.role)) {
    return { error: "Nur Admin oder Projektleiter können Kunden archivieren." };
  }
  if (!context.isWritable) {
    return { error: "Testphase abgelaufen – Archivieren ist gesperrt." };
  }

  const id = String(formData.get("id") ?? "");
  const archived = formData.get("archived") === "true";
  if (!id) {
    return { error: "Ungültiger Kunde." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("contacts")
    .update({ is_archived: archived })
    .eq("id", id);

  if (error) {
    if (readonlyErrorMessage(error.message)) {
      return { error: "Testphase abgelaufen – Archivieren ist gesperrt." };
    }
    return { error: "Aktion fehlgeschlagen." };
  }

  revalidatePath("/kunden");
  revalidatePath(`/kunden/${id}`);
  return { error: null };
}
