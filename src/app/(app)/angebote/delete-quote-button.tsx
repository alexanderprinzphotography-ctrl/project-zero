"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { deleteQuote, type QuoteActionState } from "./actions";

const INITIAL_STATE: QuoteActionState = { error: null };

export function DeleteQuoteButton({ id }: { id: string }) {
  const [state, formAction, pending] = useActionState(deleteQuote, INITIAL_STATE);

  return (
    <form action={formAction} className="inline-flex flex-col items-end gap-1">
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="destructive" size="sm" disabled={pending}>
        {pending ? "…" : "Löschen"}
      </Button>
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
    </form>
  );
}
