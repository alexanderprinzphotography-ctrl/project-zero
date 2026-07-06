import { createClient } from "@/core/supabase/server";

export type UserContext = {
  userId: string;
  email: string;
  fullName: string | null;
  role: string;
  companyName: string;
};

type ProfileRow = {
  full_name: string | null;
  role: string;
  email: string | null;
  companies: { name: string } | null;
};

/**
 * Liest Profil + Firma des aktuell angemeldeten Nutzers (fuer Header/Anzeige).
 * Liefert null, wenn nicht angemeldet oder das Profil noch nicht existiert.
 */
export async function getUserContext(): Promise<UserContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, email, companies(name)")
    .eq("id", user.id)
    .maybeSingle<ProfileRow>();

  if (!profile) return null;

  return {
    userId: user.id,
    email: profile.email ?? user.email ?? "",
    fullName: profile.full_name,
    role: profile.role,
    companyName: profile.companies?.name ?? "",
  };
}
