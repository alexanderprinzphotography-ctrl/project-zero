"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/core/supabase/server";
import { getUserContext } from "@/core/auth/get-user-context";
import { parseEuroInputToCents } from "@/core/money/cents";

export type CatalogActionState = { error: string | null; successAt: number | null };

const INITIAL_STATE: CatalogActionState = { error: null, successAt: null };

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

type ParsedCatalogItem = {
  item_number: string | null;
  name: string;
  description: string | null;
  unit: string;
  unit_price_net_cents: number;
  category: string | null;
};

function parseCatalogItemForm(formData: FormData): {
  error: string | null;
  input: ParsedCatalogItem | null;
} {
  const name = String(formData.get("name") ?? "").trim();
  const unit = String(formData.get("unit") ?? "").trim();
  const priceInput = String(formData.get("unitPriceEuro") ?? "").trim();

  if (!name) return { error: "Bitte einen Namen angeben.", input: null };
  if (!unit) return { error: "Bitte eine Einheit angeben.", input: null };

  const priceCents = parseEuroInputToCents(priceInput);
  if (priceCents === null) {
    return { error: "Bitte einen gültigen Preis angeben (z. B. 19,99).", input: null };
  }

  return {
    error: null,
    input: {
      item_number: nullableTrim(formData.get("itemNumber")),
      name,
      description: nullableTrim(formData.get("description")),
      unit,
      unit_price_net_cents: priceCents,
      category: nullableTrim(formData.get("category")),
    },
  };
}

function mapInsertError(message: string): string {
  if (readonlyErrorMessage(message)) {
    return "Testphase abgelaufen – Speichern ist gesperrt.";
  }
  if (message.includes("catalog_items_company_item_number_unique")) {
    return "Diese Artikelnummer wird bereits verwendet.";
  }
  return "Eintrag konnte nicht gespeichert werden.";
}

export async function createCatalogItem(
  _prevState: CatalogActionState,
  formData: FormData,
): Promise<CatalogActionState> {
  const context = await getUserContext();
  if (!context || !isAdminOrProjektleiter(context.role)) {
    return { ...INITIAL_STATE, error: "Nur Admin oder Projektleiter können den Katalog pflegen." };
  }
  if (!context.isWritable) {
    return { ...INITIAL_STATE, error: "Testphase abgelaufen – Speichern ist gesperrt." };
  }

  const { error: validationError, input } = parseCatalogItemForm(formData);
  if (validationError || !input) {
    return { ...INITIAL_STATE, error: validationError };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("catalog_items").insert(input);

  if (error) {
    return { ...INITIAL_STATE, error: mapInsertError(error.message) };
  }

  revalidatePath("/leistungskatalog");
  return { ...INITIAL_STATE, successAt: Date.now() };
}

export async function updateCatalogItem(
  id: string,
  _prevState: CatalogActionState,
  formData: FormData,
): Promise<CatalogActionState> {
  const context = await getUserContext();
  if (!context || !isAdminOrProjektleiter(context.role)) {
    return { ...INITIAL_STATE, error: "Nur Admin oder Projektleiter können den Katalog pflegen." };
  }
  if (!context.isWritable) {
    return { ...INITIAL_STATE, error: "Testphase abgelaufen – Bearbeiten ist gesperrt." };
  }

  const { error: validationError, input } = parseCatalogItemForm(formData);
  if (validationError || !input) {
    return { ...INITIAL_STATE, error: validationError };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("catalog_items").update(input).eq("id", id);

  if (error) {
    return { ...INITIAL_STATE, error: mapInsertError(error.message) };
  }

  revalidatePath("/leistungskatalog");
  return { ...INITIAL_STATE, successAt: Date.now() };
}

export async function setCatalogItemActive(
  _prevState: CatalogActionState,
  formData: FormData,
): Promise<CatalogActionState> {
  const context = await getUserContext();
  if (!context || !isAdminOrProjektleiter(context.role)) {
    return { ...INITIAL_STATE, error: "Nur Admin oder Projektleiter können den Katalog pflegen." };
  }
  if (!context.isWritable) {
    return { ...INITIAL_STATE, error: "Testphase abgelaufen – Ändern ist gesperrt." };
  }

  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "true";
  if (!id) return { ...INITIAL_STATE, error: "Ungültiger Eintrag." };

  const supabase = await createClient();
  const { error } = await supabase.from("catalog_items").update({ is_active: active }).eq("id", id);

  if (error) {
    return { ...INITIAL_STATE, error: mapInsertError(error.message) };
  }

  revalidatePath("/leistungskatalog");
  return { ...INITIAL_STATE, successAt: Date.now() };
}
