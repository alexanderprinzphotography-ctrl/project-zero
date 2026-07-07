"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { BillingInterval, PlanTier } from "@/core/billing/stripe";
import { createCheckoutSession, type CheckoutActionState } from "./actions";

const INITIAL_STATE: CheckoutActionState = { error: null };

export function CheckoutButton({ tier, interval }: { tier: PlanTier; interval: BillingInterval }) {
  const [state, formAction, pending] = useActionState(createCheckoutSession, INITIAL_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-1">
      <input type="hidden" name="tier" value={tier} />
      <input type="hidden" name="interval" value={interval} />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Weiterleitung…" : "Diesen Plan wählen"}
      </Button>
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
    </form>
  );
}
