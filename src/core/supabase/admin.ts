import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-Role-Client: umgeht RLS vollstaendig. NUR fuer serverseitigen Code
 * ohne Nutzer-Session verwenden, der sich selbst zuverlaessig autorisiert hat -
 * aktuell ausschliesslich der signatur-verifizierte Stripe-Webhook (Stripe
 * ruft uns direkt auf, es gibt keine Supabase-Session dafuer). NIEMALS in
 * einer normalen Server Action fuer nutzerausgeloeste Requests einsetzen.
 */
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY ist nicht konfiguriert.");
  }

  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
