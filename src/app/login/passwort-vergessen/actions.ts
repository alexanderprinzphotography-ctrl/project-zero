"use server";

import { headers } from "next/headers";
import { createClient } from "@/core/supabase/server";

export type ResetActionState = { error: string | null; info: string | null };

export async function requestPasswordReset(
  _prevState: ResetActionState,
  formData: FormData,
): Promise<ResetActionState> {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    return { error: "Bitte E-Mail-Adresse angeben.", info: null };
  }

  const supabase = await createClient();
  const origin = (await headers()).get("origin");

  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm?type=recovery&next=/konto/neues-passwort`,
  });

  // Immer dieselbe Meldung, unabhaengig davon ob die E-Mail existiert
  // (verhindert, dass sich registrierte Adressen erraten lassen).
  return {
    error: null,
    info: "Falls ein Konto mit dieser E-Mail existiert, haben wir einen Link zum Zuruecksetzen gesendet.",
  };
}
