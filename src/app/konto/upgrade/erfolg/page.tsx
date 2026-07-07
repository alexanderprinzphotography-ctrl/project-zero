import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getUserContext } from "@/core/auth/get-user-context";

/**
 * Reine Bestaetigungs-/Rueckkehrseite nach dem Stripe-Checkout - setzt selbst
 * NICHTS Verbindliches. Der tatsaechliche plan_status kommt ausschliesslich
 * ueber den signatur-verifizierten Webhook, der in aller Regel binnen weniger
 * Sekunden eintrifft, aber nicht garantiert VOR dieser Weiterleitung fertig ist.
 */
export default async function UpgradeErfolgPage() {
  const context = await getUserContext();
  if (!context) redirect("/login");

  return (
    <div className="flex justify-center">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Vielen Dank!</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <p>
            Deine Zahlung wurde von Stripe entgegengenommen. Der Abo-Status wird automatisch
            aktualisiert, sobald Stripe die Bestätigung sendet – das dauert in der Regel nur wenige
            Sekunden.
          </p>
          <p className="text-muted-foreground">
            Aktueller Status: {context.planStatus === "active" ? "Aktiv ✓" : "Wird verarbeitet…"}
          </p>
          <div className="flex gap-2">
            <Link href="/konto/upgrade">
              <Button variant="outline">Status aktualisieren</Button>
            </Link>
            <Link href="/">
              <Button>Zur Übersicht</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
