import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/core/ui/page-header";
import { createClient } from "@/core/supabase/server";
import { getUserContext } from "@/core/auth/get-user-context";
import { getDisplayPrices, type BillingInterval, type PlanTier } from "@/core/billing/stripe";
import { PlanSelector } from "./plan-selector";
import { PortalButton } from "./portal-button";

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("de-DE");
}

function statusText(company: {
  plan_status: string;
  plan_tier: PlanTier | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
}): string {
  switch (company.plan_status) {
    case "trial":
      return company.trial_ends_at
        ? `Testphase bis ${formatDate(company.trial_ends_at)}`
        : "Testphase";
    case "active": {
      const tierLabel = company.plan_tier === "pro" ? "Pro" : company.plan_tier === "basic" ? "Basic" : "unbekannter Plan";
      return `Aktiv (${tierLabel})${
        company.current_period_end ? ` – läuft bis ${formatDate(company.current_period_end)}` : ""
      }`;
    }
    case "past_due":
      return "Zahlung fehlgeschlagen – bitte Zahlungsmittel im Kundenportal aktualisieren.";
    case "canceled":
      return "Abo gekündigt – Nur-Lese-Zugriff.";
    case "expired":
      return "Testphase abgelaufen – Nur-Lese-Zugriff.";
    default:
      return company.plan_status;
  }
}

export default async function UpgradePage({
  searchParams,
}: {
  searchParams: Promise<{ abgebrochen?: string }>;
}) {
  const { abgebrochen } = await searchParams;
  const context = await getUserContext();

  if (!context) redirect("/login");
  if (context.role !== "admin") redirect("/");

  const supabase = await createClient();
  const { data: company } = await supabase
    .from("companies")
    .select("plan_status, plan_tier, billing_interval, current_period_end, stripe_customer_id, trial_ends_at")
    .eq("id", context.companyId)
    .single();

  let prices: Awaited<ReturnType<typeof getDisplayPrices>> = [];
  let pricesError = false;
  try {
    prices = await getDisplayPrices();
  } catch (err) {
    console.error("Stripe-Preise konnten nicht geladen werden", err);
    pricesError = true;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Abo" description={context.companyName} />

      {abgebrochen === "1" && (
        <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
          Checkout abgebrochen – es wurde nichts geändert.
        </p>
      )}

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Status</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <p>{company ? statusText(company) : "Unbekannt"}</p>
          {company?.stripe_customer_id && <PortalButton />}
        </CardContent>
      </Card>

      {pricesError ? (
        <p className="text-sm text-destructive">
          Preise konnten nicht geladen werden. Bitte Stripe-Konfiguration prüfen.
        </p>
      ) : (
        <PlanSelector
          prices={prices}
          currentTier={(company?.plan_tier as PlanTier | null) ?? null}
          currentInterval={(company?.billing_interval as BillingInterval | null) ?? null}
        />
      )}
    </div>
  );
}
