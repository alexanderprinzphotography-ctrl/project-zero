"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { Quote } from "@/core/quotes/quote";
import { approveQuote, setQuoteStatus, submitQuoteForApproval, type QuoteActionState } from "./actions";

const INITIAL_STATE: QuoteActionState = { error: null };

export function QuoteStatusActions({ quote, canEdit }: { quote: Quote; canEdit: boolean }) {
  const [submitState, submitAction, submitPending] = useActionState(submitQuoteForApproval, INITIAL_STATE);
  const [approveState, approveAction, approvePending] = useActionState(approveQuote, INITIAL_STATE);
  const [statusState, statusAction, statusPending] = useActionState(setQuoteStatus, INITIAL_STATE);

  if (!canEdit) return null;

  const error = submitState.error || approveState.error || statusState.error;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {(quote.status === "entwurf" || quote.status === "zur_freigabe") && (
          <>
            <form action={submitAction}>
              <input type="hidden" name="id" value={quote.id} />
              <Button type="submit" variant="outline" size="sm" disabled={submitPending}>
                {submitPending ? "…" : "Zur Freigabe einreichen"}
              </Button>
            </form>
            <form action={approveAction}>
              <input type="hidden" name="id" value={quote.id} />
              <Button type="submit" size="sm" disabled={approvePending}>
                {approvePending ? "…" : "Direkt freigeben"}
              </Button>
            </form>
          </>
        )}
        {quote.status === "freigegeben" && (
          <form action={statusAction}>
            <input type="hidden" name="id" value={quote.id} />
            <input type="hidden" name="targetStatus" value="gesendet" />
            <Button type="submit" size="sm" disabled={statusPending}>
              {statusPending ? "…" : "Als gesendet markieren"}
            </Button>
          </form>
        )}
        {quote.status === "gesendet" && (
          <>
            <form action={statusAction}>
              <input type="hidden" name="id" value={quote.id} />
              <input type="hidden" name="targetStatus" value="angenommen" />
              <Button type="submit" size="sm" disabled={statusPending}>
                {statusPending ? "…" : "Als angenommen markieren"}
              </Button>
            </form>
            <form action={statusAction}>
              <input type="hidden" name="id" value={quote.id} />
              <input type="hidden" name="targetStatus" value="abgelehnt" />
              <Button type="submit" variant="destructive" size="sm" disabled={statusPending}>
                {statusPending ? "…" : "Als abgelehnt markieren"}
              </Button>
            </form>
          </>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
