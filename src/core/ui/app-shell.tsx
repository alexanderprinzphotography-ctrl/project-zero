import type { ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { signOut } from "@/core/auth/actions";
import type { UserContext } from "@/core/auth/get-user-context";
import { TrialBanner } from "@/core/ui/trial-banner";
import { ThemeToggle } from "@/core/ui/theme-toggle";
import type { ThemeMode } from "@/core/theme/theme-cookie";

/**
 * Grundgerüst der App: Header mit Firmenlogo (oder Platzhalter), Seitennavigation,
 * Content-Bereich. Branchenagnostisch — branchenspezifische Navigation kommt
 * später aus modules/handwerk.
 */
export function AppShell({
  children,
  userContext,
  themeMode,
}: {
  children: ReactNode;
  userContext: UserContext | null;
  themeMode: ThemeMode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-border px-6">
        <div className="flex items-center gap-2 text-lg font-semibold">
          {userContext?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- externe Supabase-Storage-URL, keine next/image-Domainkonfiguration noetig
            <img
              src={userContext.logoUrl}
              alt={`${userContext.companyName} Logo`}
              className="h-8 w-8 rounded object-contain"
            />
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-sm text-primary-foreground">
              BZ
            </span>
          )}
          <span>Baustellen-Zentrale</span>
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle current={themeMode} />
          {userContext ? (
            <div className="flex items-center gap-4 text-sm">
              <span className="text-muted-foreground">
                {userContext.companyName} · {userContext.fullName ?? userContext.email} (
                {userContext.role})
              </span>
              <form action={signOut}>
                <Button type="submit" variant="outline" size="sm">
                  Abmelden
                </Button>
              </form>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-sm">
              <Link href="/login" className="text-muted-foreground hover:text-foreground">
                Anmelden
              </Link>
              <Link href="/registrieren">
                <Button size="sm">Registrieren</Button>
              </Link>
            </div>
          )}
        </div>
      </header>
      {userContext && <TrialBanner context={userContext} />}
      <div className="flex flex-1">
        <aside
          aria-label="Seitennavigation"
          className="hidden w-56 shrink-0 border-r border-border p-4 md:block"
        >
          {userContext && (
            <nav className="flex flex-col gap-1 text-sm">
              <Link
                href="/projekte"
                className="rounded-md px-2 py-1.5 hover:bg-accent hover:text-accent-foreground"
              >
                Projekte
              </Link>
              <Link
                href="/kunden"
                className="rounded-md px-2 py-1.5 hover:bg-accent hover:text-accent-foreground"
              >
                Kunden
              </Link>
              <Link
                href="/zeiten"
                className="rounded-md px-2 py-1.5 hover:bg-accent hover:text-accent-foreground"
              >
                Zeiten
              </Link>
              {userContext.role !== "mitarbeiter" && (
                <Link
                  href="/team"
                  className="rounded-md px-2 py-1.5 hover:bg-accent hover:text-accent-foreground"
                >
                  Team
                </Link>
              )}
              {userContext.role === "admin" && (
                <Link
                  href="/einstellungen"
                  className="rounded-md px-2 py-1.5 hover:bg-accent hover:text-accent-foreground"
                >
                  Einstellungen
                </Link>
              )}
            </nav>
          )}
        </aside>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
