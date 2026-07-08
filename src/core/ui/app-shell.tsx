import type { ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { UserContext } from "@/core/auth/get-user-context";
import { TrialBanner } from "@/core/ui/trial-banner";
import { SidebarNav } from "@/core/ui/sidebar-nav";
import { UserMenu } from "@/core/ui/user-menu";
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
          <span className="font-heading">Baustellen-Zentrale</span>
        </div>
        {userContext ? (
          <UserMenu context={userContext} themeMode={themeMode} />
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
      </header>
      {userContext && <TrialBanner context={userContext} />}
      <div className="flex flex-1">
        <aside
          aria-label="Seitennavigation"
          className="hidden w-56 shrink-0 border-r border-sidebar-border bg-sidebar p-4 md:block"
        >
          {userContext && <SidebarNav role={userContext.role} />}
        </aside>
        <main className="flex-1 overflow-x-hidden">
          <div className="mx-auto w-full max-w-[1400px] p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
