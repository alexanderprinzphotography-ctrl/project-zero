"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { createPortalSession, type CheckoutActionState } from "./actions";

const INITIAL_STATE: CheckoutActionState = { error: null };

export function PortalButton() {
  const [state, formAction, pending] = useActionState(createPortalSession, INITIAL_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-1">
      <Button type="submit" variant="outline" disabled={pending} className="w-fit">
        {pending ? "…" : "Abo verwalten"}
      </Button>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
