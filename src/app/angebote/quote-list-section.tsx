import Link from "next/link";
import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/core/ui/empty-state";
import { ListContainer, ListRow } from "@/core/ui/list";
import { createClient } from "@/core/supabase/server";
import { hasFeature } from "@/core/billing/entitlements";
import { formatCentsAsEuro } from "@/core/money/cents";
import { quoteStatusVariant, quoteStatusLabel, type QuoteStatus } from "@/core/quotes/quote";
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
        <EmptyState icon={FileText} title="Noch keine Angebote." />
      ) : (
        <ListContainer>
          {quotes.map((quote) => (
            <ListRow key={quote.id} href={`/angebote/${quote.id}`}>
              <span>
                #{quote.quote_number} · {new Date(quote.quote_date).toLocaleDateString("de-DE")}
              </span>
              <span className="flex items-center gap-2">
                <Badge variant={quoteStatusVariant(quote.status)}>{quoteStatusLabel(quote.status)}</Badge>
                <span className="font-medium">{formatCentsAsEuro(quote.gross_total_cents)}</span>
              </span>
            </ListRow>
          ))}
        </ListContainer>
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
