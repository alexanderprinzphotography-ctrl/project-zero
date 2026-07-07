"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCentsAsEuro } from "@/core/money/cents";
import type { BillingInterval, DisplayPrice, PlanTier } from "@/core/billing/stripe";
import { CheckoutButton } from "./checkout-button";

const TIER_LABELS: Record<PlanTier, string> = { basic: "Basic", pro: "Pro" };

export function PlanSelector({
  prices,
  currentTier,
  currentInterval,
}: {
  prices: DisplayPrice[];
  currentTier: PlanTier | null;
  currentInterval: BillingInterval | null;
}) {
  const [interval, setInterval] = useState<BillingInterval>(currentInterval ?? "month");
  const tiers: PlanTier[] = ["basic", "pro"];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <Button
          type="button"
          variant={interval === "month" ? "default" : "outline"}
          size="sm"
          onClick={() => setInterval("month")}
        >
          Monatlich
        </Button>
        <Button
          type="button"
          variant={interval === "year" ? "default" : "outline"}
          size="sm"
          onClick={() => setInterval("year")}
        >
          Jährlich
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {tiers.map((tier) => {
          const price = prices.find((p) => p.tier === tier && p.interval === interval);
          const isCurrent = currentTier === tier && currentInterval === interval;

          return (
            <Card key={tier}>
              <CardHeader>
                <CardTitle>{TIER_LABELS[tier]}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {price?.unitAmountCents != null ? (
                  <p className="text-2xl font-semibold">
                    {formatCentsAsEuro(price.unitAmountCents)}
                    <span className="text-sm font-normal text-muted-foreground">
                      {" "}
                      / {interval === "month" ? "Monat" : "Jahr"}
                    </span>
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">Preis nicht verfügbar</p>
                )}
                {isCurrent ? (
                  <span className="w-fit rounded-full bg-primary/15 px-3 py-1 text-xs text-primary">
                    Aktueller Plan
                  </span>
                ) : (
                  <CheckoutButton tier={tier} interval={interval} />
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
