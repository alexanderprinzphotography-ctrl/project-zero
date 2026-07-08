import Link from "next/link";
import { CircleAlert, TriangleAlert } from "lucide-react";
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
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-warning/30 bg-warning/10 px-6 py-1.5 text-sm text-warning-foreground">
        <span className="flex items-center gap-2">
          <TriangleAlert className="size-4 shrink-0" />
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
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-destructive/30 bg-destructive/10 px-6 py-1.5 text-sm text-destructive">
        <span className="flex items-center gap-2">
          <TriangleAlert className="size-4 shrink-0" />
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
    <div className="flex items-center gap-1.5 border-b border-border bg-muted/50 px-6 py-1.5 text-xs text-muted-foreground">
      <CircleAlert className="size-3.5 shrink-0" />
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
