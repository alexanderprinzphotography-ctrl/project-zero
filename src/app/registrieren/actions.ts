"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/core/supabase/server";
import { ensureCompanyForUser } from "@/core/auth/ensure-company";

export type RegisterActionState = { error: string | null; info: string | null };

export async function registerCompany(
  _prevState: RegisterActionState,
  formData: FormData,
): Promise<RegisterActionState> {
  const companyName = String(formData.get("companyName") ?? "").trim();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!companyName || !fullName || !email || !password) {
    return { error: "Bitte alle Felder ausfuellen.", info: null };
  }
  if (password.length < 8) {
    return { error: "Passwort muss mindestens 8 Zeichen lang sein.", info: null };
  }

  const supabase = await createClient();
  const origin = (await headers()).get("origin");

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Wird in ensureCompanyForUser() gelesen, sobald die Registrierung
      // abgeschlossen werden kann (sofort oder nach E-Mail-Bestaetigung).
      data: { company_name: companyName, full_name: fullName },
      emailRedirectTo: `${origin}/auth/confirm?next=/`,
    },
  });

  if (error) {
    if (error.message.toLowerCase().includes("already registered")) {
      return { error: "Diese E-Mail-Adresse ist bereits registriert.", info: null };
    }
    return { error: "Registrierung fehlgeschlagen. Bitte versuche es erneut.", info: null };
  }

  if (!data.session) {
    return {
      error: null,
      info: "Registrierung erfolgreich. Bitte bestaetige deine E-Mail-Adresse, um die Einrichtung deiner Firma abzuschliessen.",
    };
  }

  await ensureCompanyForUser(supabase);
  redirect("/");
}
