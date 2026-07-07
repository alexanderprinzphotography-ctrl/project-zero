import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { UserContext } from "@/core/auth/get-user-context";

/**
 * Rein informativ (UI-Komfort) - die eigentliche Durchsetzung der Nur-Lese-Sperre
 * erfolgt ausschliesslich per RLS (company_is_writable()) in der Datenbank.
 */
export function TrialBanner({ context }: { context: UserContext }) {
  if (context.planStatus === "active") return null;

  // past_due ist Kulanzzeitraum (Stripe versucht die Zahlung erneut) - bleibt
  // schreibbar, verdient aber eine deutliche Warnung statt der Nur-Lese-Meldung.
  if (context.planStatus === "past_due") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/30 bg-amber-500/10 px-6 py-2 text-sm">
        <span>
          Zahlung fehlgeschlagen – bitte Zahlungsmittel aktualisieren, sonst wird der Zugriff gesperrt.
          {context.role !== "admin" && " Bitte an den Admin wenden."}
        </span>
        {context.role === "admin" && (
          <Link href="/konto/upgrade">
            <Button size="sm">Zahlungsmittel aktualisieren</Button>
          </Link>
        )}
      </div>
    );
  }

  if (!context.isWritable) {
    const message =
      context.planStatus === "canceled"
        ? "Abo gekündigt – Nur-Lese-Zugriff."
        : "Testphase abgelaufen – Nur-Lese-Zugriff.";

    return (
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-destructive/30 bg-destructive/10 px-6 py-2 text-sm">
        <span>
          {message}
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
