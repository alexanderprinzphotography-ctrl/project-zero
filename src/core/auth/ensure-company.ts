import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Schliesst eine begonnene Registrierung/Einladungsannahme ab, falls noch kein
 * Profil existiert (z. B. direkt nach signUp ohne E-Mail-Bestaetigung, oder nach
 * dem ersten Login nach Bestaetigung). Verhindert angemeldete Nutzer ohne
 * Firma/Profil. Liegt ein invitation_token in den user_metadata (Einladungs-
 * Beitritt), wird accept_invitation() statt register_company() aufgerufen -
 * dieser Pfad legt bewusst KEINE neue Firma an.
 */
export async function ensureCompanyForUser(supabase: SupabaseClient): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (profile) return;

  const fullName = String(user.user_metadata?.full_name ?? "").trim();
  const invitationToken = String(user.user_metadata?.invitation_token ?? "").trim();

  if (invitationToken) {
    const { error } = await supabase.rpc("accept_invitation", {
      token: invitationToken,
      full_name: fullName,
    });

    if (error && !error.message.includes("bereits zu einer Firma")) {
      throw error;
    }
    return;
  }

  const companyName = String(user.user_metadata?.company_name ?? "").trim() || "Meine Firma";

  const { error } = await supabase.rpc("register_company", {
    company_name: companyName,
    full_name: fullName,
  });

  // "Nutzer hat bereits ein Profil" kann bei einem Wettlauf zweier gleichzeitiger
  // Aufrufe auftreten (z. B. Login + Confirm-Callback kurz hintereinander) - dann
  // hat der andere Aufruf die Registrierung bereits abgeschlossen, kein Fehler.
  if (error && !error.message.includes("bereits ein Profil")) {
    throw error;
  }
}
