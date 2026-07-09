"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/core/supabase/server";
import { ensureCompanyForUser } from "@/core/auth/ensure-company";

export type AuthActionState = { error: string | null };

export async function signIn(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/");

  if (!email || !password) {
    return { error: "Bitte E-Mail und Passwort angeben." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Anmeldung fehlgeschlagen. E-Mail oder Passwort ist falsch." };
  }

  await ensureCompanyForUser(supabase);

  redirect(next.startsWith("/") ? next : "/");
}
