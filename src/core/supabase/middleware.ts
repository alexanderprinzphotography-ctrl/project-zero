import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Oeffentliche Pfade, die ohne Sitzung erreichbar sein muessen (Login, Registrierung,
 * Passwort-Reset-Anfrage, E-Mail-Bestaetigungs-/Recovery-Callback, Stripe-Webhook -
 * Stripe hat nie eine Supabase-Session, der Webhook verifiziert sich stattdessen
 * selbst ueber die Signaturpruefung, siehe app/api/stripe/webhook/route.ts).
 */
const PUBLIC_PATHS = ["/login", "/registrieren", "/auth/confirm", "/einladung", "/api/stripe/webhook"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/**
 * Frischt die Supabase-Session bei jedem Request auf und leitet nicht angemeldete
 * Nutzer auf /login um. Muss aus der Root-`middleware.ts` aufgerufen werden.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Wichtig: getUser() (nicht getSession()) validiert das Token gegen den
  // Supabase-Server statt nur das ungeprueft aus dem Cookie zu lesen.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublicPath(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
