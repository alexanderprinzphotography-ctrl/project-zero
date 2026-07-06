"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/core/supabase/server";
import { ensureCompanyForUser } from "@/core/auth/ensure-company";

export type InviteActionState = { error: string | null; info: string | null };

function acceptErrorMessage(): string {
  return "Einladung konnte nicht angenommen werden. Sie ist evtl. abgelaufen, widerrufen oder bereits vollstaendig genutzt.";
}

export async function acceptAsNewAccount(
  token: string,
  _prevState: InviteActionState,
  formData: FormData,
): Promise<InviteActionState> {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!fullName || !email || !password) {
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
      // Wird in ensureCompanyForUser() gelesen, sobald die Einladung
      // angenommen werden kann (sofort oder nach E-Mail-Bestaetigung).
      data: { invitation_token: token, full_name: fullName },
      emailRedirectTo: `${origin}/auth/confirm?next=/`,
    },
  });

  if (error) {
    if (error.message.toLowerCase().includes("already registered")) {
      return {
        error: "Diese E-Mail-Adresse ist bereits registriert. Bitte melde dich stattdessen an.",
        info: null,
      };
    }
    return { error: "Registrierung fehlgeschlagen. Bitte versuche es erneut.", info: null };
  }

  if (!data.session) {
    return {
      error: null,
      info: "Konto erstellt. Bitte bestaetige deine E-Mail-Adresse, um der Firma beizutreten.",
    };
  }

  try {
    await ensureCompanyForUser(supabase);
  } catch {
    return { error: acceptErrorMessage(), info: null };
  }

  redirect("/");
}

export async function acceptAsExistingAccount(
  token: string,
  _prevState: InviteActionState,
  formData: FormData,
): Promise<InviteActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Bitte E-Mail und Passwort angeben.", info: null };
  }

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

  if (signInError) {
    return { error: "Anmeldung fehlgeschlagen. E-Mail oder Passwort ist falsch.", info: null };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user!.id)
    .maybeSingle();

  if (existingProfile) {
    return { error: "Dieser Account gehoert bereits zu einer Firma.", info: null };
  }

  const { error: acceptError } = await supabase.rpc("accept_invitation", {
    token,
    full_name: "",
  });

  if (acceptError) {
    return { error: acceptErrorMessage(), info: null };
  }

  redirect("/");
}

export async function acceptAsLoggedInUser(
  token: string,
  _prevState: InviteActionState,
  formData: FormData,
): Promise<InviteActionState> {
  const fullName = String(formData.get("fullName") ?? "").trim();

  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_invitation", { token, full_name: fullName });

  if (error) {
    return { error: acceptErrorMessage(), info: null };
  }

  redirect("/");
}
