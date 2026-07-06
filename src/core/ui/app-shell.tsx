import type { ReactNode } from "react";

/**
 * Grundgerüst der App: Header mit Platzhalter-Logo, leere Seitennavigation, Content-Bereich.
 * Branchenagnostisch — branchenspezifische Navigation kommt später aus modules/handwerk.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-16 shrink-0 items-center border-b border-border px-6">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-sm text-primary-foreground">
            BZ
          </span>
          <span>Baustellen-Zentrale</span>
        </div>
      </header>
      <div className="flex flex-1">
        <aside
          aria-label="Seitennavigation"
          className="hidden w-56 shrink-0 border-r border-border p-4 md:block"
        >
          {/* Navigation folgt mit Auth & Rollen in MS 1 */}
        </aside>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
