"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { refreshInvoiceStatus, type RefreshInvoiceStatusState } from "./invoice-actions";

const INITIAL_STATE: RefreshInvoiceStatusState = { error: null, success: null };

export function RefreshStatusButton({ invoiceId }: { invoiceId: string }) {
  const [state, formAction, pending] = useActionState(refreshInvoiceStatus, INITIAL_STATE);

  return (
    <form action={formAction} className="inline-flex flex-col items-end gap-1">
      <input type="hidden" name="invoiceId" value={invoiceId} />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? "…" : "Status aktualisieren"}
      </Button>
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
    </form>
  );
}
