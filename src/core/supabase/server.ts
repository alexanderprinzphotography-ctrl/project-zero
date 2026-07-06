import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase-Client für Server Components/Actions.
 * Liest URL und Anon-Key aus den Env-Variablen und synchronisiert Cookies.
 * Das Setzen von Cookies aus Server Components schlägt bewusst fehl (kein Middleware-Refresh in MS 0) —
 * das übernimmt die Session-Verwaltung erst in MS 1.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Components dürfen keine Cookies setzen — unkritisch ohne aktive Session.
          }
        },
      },
    },
  );
}
