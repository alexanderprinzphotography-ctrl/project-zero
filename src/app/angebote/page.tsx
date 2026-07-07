import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/core/supabase/server";
import { getUserContext } from "@/core/auth/get-user-context";
import { contactDisplayName } from "@/core/crm/contact";
import { formatCentsAsEuro } from "@/core/money/cents";
import { quoteStatusBadgeClass, quoteStatusLabel, type QuoteStatus } from "@/core/quotes/quote";

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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Angebote</h1>
          <p className="mt-1 text-muted-foreground">Angebote erstellen, freigeben und als PDF exportieren.</p>
        </div>
        {context.isWritable && (
          <Link href="/angebote/neu">
            <Button size="sm">+ Neues Angebot</Button>
          </Link>
        )}
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="q" className="text-sm font-medium">
            Suche
          </label>
          <input
            id="q"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Angebotsnummer oder Kunde…"
            className="rounded-md border border-input bg-transparent px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="status" className="text-sm font-medium">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={status ?? ""}
            className="rounded-md border border-input bg-transparent px-2 py-2 text-sm"
          >
            <option value="">Alle Status</option>
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {quoteStatusLabel(s)}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" variant="outline" size="sm">
          Filtern
        </Button>
      </form>

      <div className="flex flex-col gap-2">
        {quotes.length === 0 && (
          <p className="text-sm text-muted-foreground">Keine Angebote gefunden.</p>
        )}
        {quotes.map((quote) => (
          <Link
            key={quote.id}
            href={`/angebote/${quote.id}`}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3 text-sm hover:bg-muted/50"
          >
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span className="font-medium">#{quote.quote_number}</span>
                <span>{quote.contacts ? contactDisplayName(quote.contacts) : "–"}</span>
                {quote.projects && (
                  <span className="text-muted-foreground">· {quote.projects.title}</span>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                {new Date(quote.quote_date).toLocaleDateString("de-DE")}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className={`rounded-full px-2 py-0.5 text-xs ${quoteStatusBadgeClass(quote.status)}`}>
                {quoteStatusLabel(quote.status)}
              </span>
              <span className="font-medium">{formatCentsAsEuro(quote.gross_total_cents)}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
