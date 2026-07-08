import Link from "next/link";
import { redirect } from "next/navigation";
import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/core/ui/empty-state";
import { FilterBar, FilterField } from "@/core/ui/filter-bar";
import { ListContainer, ListRow } from "@/core/ui/list";
import { PageHeader } from "@/core/ui/page-header";
import { createClient } from "@/core/supabase/server";
import { getUserContext } from "@/core/auth/get-user-context";
import { contactDisplayName } from "@/core/crm/contact";
import { formatCentsAsEuro } from "@/core/money/cents";
import { quoteStatusVariant, quoteStatusLabel, type QuoteStatus } from "@/core/quotes/quote";

type QuoteListRow = {
  id: string;
  quote_number: number;
  status: QuoteStatus;
  quote_date: string;
  gross_total_cents: number;
  contacts: { type: "privat" | "gewerblich"; company_name: string | null; first_name: string | null; last_name: string | null } | null;
  projects: { title: string } | null;
};

const ALL_STATUSES: QuoteStatus[] = [
  "entwurf",
  "zur_freigabe",
  "freigegeben",
  "gesendet",
  "angenommen",
  "abgelehnt",
];

export default async function AngeboteListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q, status } = await searchParams;
  const context = await getUserContext();
  if (!context) redirect("/login");
  if (!["admin", "projektleiter"].includes(context.role)) redirect("/");

  const supabase = await createClient();
  const { data } = await supabase
    .from("quotes")
    .select(
      "id, quote_number, status, quote_date, gross_total_cents, contacts(type, company_name, first_name, last_name), projects(title)",
    )
    .order("quote_number", { ascending: false });

  let quotes = (data as unknown as QuoteListRow[] | null) ?? [];

  if (status) {
    quotes = quotes.filter((quote) => quote.status === status);
  }
  if (q) {
    const needle = q.trim().toLowerCase();
    quotes = quotes.filter((quote) => {
      const customerName = quote.contacts ? contactDisplayName(quote.contacts).toLowerCase() : "";
      return String(quote.quote_number).includes(needle) || customerName.includes(needle);
    });
  }

  const hasFilters = Boolean(q || status);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Angebote"
        description="Angebote erstellen, freigeben und als PDF exportieren."
        actions={
          context.isWritable ? (
            <Link href="/angebote/neu">
              <Button size="sm">+ Neues Angebot</Button>
            </Link>
          ) : undefined
        }
      />

      <FilterBar method="get">
        <FilterField label="Suche" htmlFor="q">
          <Input id="q" name="q" defaultValue={q ?? ""} placeholder="Angebotsnummer oder Kunde…" />
        </FilterField>
        <FilterField label="Status" htmlFor="status">
          <select
            id="status"
            name="status"
            defaultValue={status ?? ""}
            className="h-10 rounded-md border border-input bg-transparent px-3 text-sm"
          >
            <option value="">Alle Status</option>
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {quoteStatusLabel(s)}
              </option>
            ))}
          </select>
        </FilterField>
        <Button type="submit" variant="outline" size="sm">
          Filtern
        </Button>
      </FilterBar>

      {quotes.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={hasFilters ? "Keine Angebote für diese Filter." : "Noch keine Angebote."}
          action={
            context.isWritable && !hasFilters ? (
              <Link href="/angebote/neu">
                <Button size="sm">Erstes Angebot erstellen</Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <ListContainer>
          {quotes.map((quote) => (
            <ListRow key={quote.id} href={`/angebote/${quote.id}`}>
              <div className="grid w-full grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-4">
                <div className="min-w-0">
                  <span className="font-medium">#{quote.quote_number}</span>{" "}
                  <span>{quote.contacts ? contactDisplayName(quote.contacts) : "–"}</span>
                </div>
                <span className="truncate text-sm text-muted-foreground">
                  {quote.projects?.title ?? "–"}
                </span>
                <span className="truncate text-sm text-muted-foreground">
                  {new Date(quote.quote_date).toLocaleDateString("de-DE")}
                </span>
                <div className="flex items-center gap-3">
                  <Badge variant={quoteStatusVariant(quote.status)}>{quoteStatusLabel(quote.status)}</Badge>
                  <span className="font-medium">{formatCentsAsEuro(quote.gross_total_cents)}</span>
                </div>
              </div>
            </ListRow>
          ))}
        </ListContainer>
      )}
    </div>
  );
}
