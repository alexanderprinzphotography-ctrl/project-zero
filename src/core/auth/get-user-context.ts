import { createClient } from "@/core/supabase/server";

export type UserContext = {
  userId: string;
  email: string;
  fullName: string | null;
  role: string;
  companyName: string;
  planStatus: string;
  trialEndsAt: string | null;
  isWritable: boolean;
  trialDaysLeft: number | null;
};

type ProfileRow = {
  full_name: string | null;
  role: string;
  email: string | null;
  companies: { name: string; plan_status: string; trial_ends_at: string | null } | null;
};

function computeIsWritable(planStatus: string, trialEndsAt: string | null, now: Date): boolean {
  if (planStatus === "active") return true;
  if (planStatus === "trial" && trialEndsAt) return new Date(trialEndsAt) > now;
  return false;
}

function computeTrialDaysLeft(trialEndsAt: string | null, now: Date): number | null {
  if (!trialEndsAt) return null;
  return Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
}

/**
 * Liest Profil + Firma des aktuell angemeldeten Nutzers (fuer Header/Anzeige).
 * Liefert null, wenn nicht angemeldet oder das Profil noch nicht existiert.
 * `isWritable`/`trialDaysLeft` spiegeln company_is_writable() rein fuers UI - die
 * eigentliche Durchsetzung der Nur-Lese-Sperre passiert ausschliesslich per RLS
 * in der DB. `now` wird hier einmal serverseitig ermittelt, damit Komponenten
 * beim Rendern kein Date.now() aufrufen muessen (React-Reinheitsregel).
 */
export async function getUserContext(): Promise<UserContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, email, companies(name, plan_status, trial_ends_at)")
    .eq("id", user.id)
    .maybeSingle<ProfileRow>();

  if (!profile) return null;

  const planStatus = profile.companies?.plan_status ?? "trial";
  const trialEndsAt = profile.companies?.trial_ends_at ?? null;
  const now = new Date();

  return {
    userId: user.id,
    email: profile.email ?? user.email ?? "",
    fullName: profile.full_name,
    role: profile.role,
    companyName: profile.companies?.name ?? "",
    planStatus,
    trialEndsAt,
    isWritable: computeIsWritable(planStatus, trialEndsAt, now),
    trialDaysLeft: computeTrialDaysLeft(trialEndsAt, now),
  };
}
