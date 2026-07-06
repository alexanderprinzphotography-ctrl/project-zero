import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { UserContext } from "@/core/auth/get-user-context";

/**
 * Rein informativ (UI-Komfort) - die eigentliche Durchsetzung der Nur-Lese-Sperre
 * erfolgt ausschliesslich per RLS (company_is_writable()) in der Datenbank.
 */
export function TrialBanner({ context }: { context: UserContext }) {
  if (context.planStatus === "active") return null;

  if (!context.isWritable) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-destructive/30 bg-destructive/10 px-6 py-2 text-sm">
        <span>
          Testphase abgelaufen – Nur-Lese-Zugriff.
          {context.role !== "admin" && " Bitte an den Admin wenden."}
        </span>
        {context.role === "admin" && (
          <Link href="/konto/upgrade">
            <Button size="sm">Jetzt upgraden</Button>
          </Link>
        )}
      </div>
    );
  }

  const daysLeft = context.trialDaysLeft;

  return (
    <div className="border-b border-border bg-muted/50 px-6 py-1.5 text-xs text-muted-foreground">
      Testphase: noch {daysLeft} {daysLeft === 1 ? "Tag" : "Tage"}
      {context.role === "admin" && (
        <>
          {" · "}
          <Link href="/konto/upgrade" className="underline hover:text-foreground">
            Upgraden
          </Link>
        </>
      )}
    </div>
  );
}
