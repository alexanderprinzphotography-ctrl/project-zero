import Link from "next/link";
import { Button } from "@/components/ui/button";
import { createClient } from "@/core/supabase/server";
import { hasFeature } from "@/core/billing/entitlements";
import { formatCentsAsEuro } from "@/core/money/cents";
import { quoteStatusBadgeClass, quoteStatusLabel, type QuoteStatus } from "@/core/quotes/quote";
import { AiLockedButton } from "./ai-locked-button";

type QuoteSummaryRow = {
  id: string;
  quote_number: number;
  status: QuoteStatus;
  gross_total_cents: number;
  quote_date: string;
};

/** Kompakte Angebotsliste fuer Projekt-/Kundendetailseiten - nur fuer admin/projektleiter relevant (siehe RLS auf quotes). */
export async function QuoteListSection({
  projectId,
  customerId,
  canView,
}: {
  projectId?: string;
  customerId?: string;
  canView: boolean;
}) {
  if (!canView) return null;

  const supabase = await createClient();
  let query = supabase
    .from("quotes")
    .select("id, quote_number, status, gross_total_cents, quote_date")
    .order("quote_number", { ascending: false });
  if (projectId) query = query.eq("project_id", projectId);
  if (customerId) query = query.eq("customer_id", customerId);

  const { data } = await query;
  const quotes = (data as QuoteSummaryRow[] | null) ?? [];
  const canUseAi = await hasFeature(supabase, "ki");

  const params = new URLSearchParams();
  if (customerId) params.set("customerId", customerId);
  if (projectId) params.set("projectId", projectId);

  return (
    <div className="flex flex-col gap-2">
      {quotes.length === 0 ? (
        <p className="text-sm text-muted-foreground">Noch keine Angebote.</p>
      ) : (
        quotes.map((quote) => (
          <Link
            key={quote.id}
            href={`/angebote/${quote.id}`}
            className="flex items-center justify-between rounded-md border border-border p-2 text-sm hover:bg-muted/50"
          >
            <span>
              #{quote.quote_number} · {new Date(quote.quote_date).toLocaleDateString("de-DE")}
            </span>
            <span className="flex items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-xs ${quoteStatusBadgeClass(quote.status)}`}>
                {quoteStatusLabel(quote.status)}
              </span>
              <span className="font-medium">{formatCentsAsEuro(quote.gross_total_cents)}</span>
            </span>
          </Link>
        ))
      )}
      <div className="flex gap-2">
        <Link href={`/angebote/neu?${params.toString()}`}>
          <Button type="button" variant="outline" size="sm" className="w-fit">
            + Neues Angebot
          </Button>
        </Link>
        {canUseAi ? (
          <Link href={`/angebote/ki-entwurf?${params.toString()}`}>
            <Button type="button" variant="outline" size="sm" className="w-fit">
              Angebot mit KI erstellen
            </Button>
          </Link>
        ) : (
          <AiLockedButton />
        )}
      </div>
    </div>
  );
}
