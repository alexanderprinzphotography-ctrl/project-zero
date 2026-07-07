import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/core/supabase/server";
import { getUserContext } from "@/core/auth/get-user-context";
import { contactDisplayName, type ContactType } from "@/core/crm/contact";
import { formatCentsAsEuro } from "@/core/money/cents";
import {
  isQuoteEditable,
  quoteStatusBadgeClass,
  quoteStatusLabel,
  type Quote,
  type QuoteItem,
} from "@/core/quotes/quote";
import { DeleteQuoteButton } from "../delete-quote-button";
import { QuoteItemList } from "../quote-item-list";
import { QuoteStatusActions } from "../quote-status-actions";
import type { CatalogItemOption } from "../quote-item-form";

type QuoteDetailRow = Quote & {
  contacts: {
    id: string;
    type: ContactType;
    company_name: string | null;
    first_name: string | null;
    last_name: string | null;
  } | null;
  projects: { id: string; title: string } | null;
};

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("de-DE");
}

export default async function AngebotDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await getUserContext();
  if (!context) redirect("/login");
  if (!["admin", "projektleiter"].includes(context.role)) redirect("/");

  const supabase = await createClient();
  const { data: quote } = await supabase
    .from("quotes")
    .select("*, contacts(id, type, company_name, first_name, last_name), projects(id, title)")
    .eq("id", id)
    .maybeSingle<QuoteDetailRow>();

  if (!quote) notFound();

  const { data: itemRows } = await supabase
    .from("quote_items")
    .select(
      "id, quote_id, position, catalog_item_id, name, unit, quantity, unit_price_net_cents, line_total_net_cents, is_ai_suggested, ai_note",
    )
    .eq("quote_id", id)
    .order("position", { ascending: true });
  const items = (itemRows as QuoteItem[] | null) ?? [];

  const { data: catalogRows } = await supabase
    .from("catalog_items")
    .select("id, name, unit, unit_price_net_cents")
    .eq("is_active", true)
    .order("name", { ascending: true });
  const catalogItems = (catalogRows as CatalogItemOption[] | null) ?? [];

  const editable = isQuoteEditable(quote.status) && context.isWritable;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Angebot #{quote.quote_number}</h1>
          <p className="mt-1 text-muted-foreground">
            {quote.contacts && contactDisplayName(quote.contacts)}
            {quote.projects && <> · {quote.projects.title}</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {quote.is_ai_generated && (
            <span className="rounded-full bg-violet-500/15 px-3 py-1 text-xs text-violet-700 dark:text-violet-400">
              Entwurf mit KI erstellt
            </span>
          )}
          <span className={`rounded-full px-3 py-1 text-xs ${quoteStatusBadgeClass(quote.status)}`}>
            {quoteStatusLabel(quote.status)}
          </span>
          {editable && (
            <Link href={`/angebote/${quote.id}/bearbeiten`}>
              <Button size="sm" variant="outline">
                Kopfdaten bearbeiten
              </Button>
            </Link>
          )}
          <a href={`/angebote/${quote.id}/pdf`} target="_blank" rel="noreferrer">
            <Button size="sm" variant="outline">
              PDF
            </Button>
          </a>
          {context.isWritable && quote.status === "entwurf" && (
            <DeleteQuoteButton id={quote.id} />
          )}
        </div>
      </div>

      <QuoteStatusActions quote={quote} canEdit={context.isWritable} />

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Angaben</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Angebotsdatum</dt>
              <dd>{formatDate(quote.quote_date)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Gültig bis</dt>
              <dd>{formatDate(quote.valid_until)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Steuersatz</dt>
              <dd>{quote.tax_rate} %</dd>
            </div>
            {quote.approved_at && (
              <div>
                <dt className="text-xs text-muted-foreground">Freigegeben am</dt>
                <dd>{formatDate(quote.approved_at)}</dd>
              </div>
            )}
          </dl>
          {quote.intro_text && (
            <div className="mt-4">
              <dt className="text-xs text-muted-foreground">Einleitung</dt>
              <dd className="whitespace-pre-wrap text-sm">{quote.intro_text}</dd>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Positionen</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <QuoteItemList quoteId={quote.id} items={items} catalogItems={catalogItems} canEdit={editable} />

          <div className="flex flex-col items-end gap-1 border-t border-border pt-4 text-sm">
            <div className="flex w-56 justify-between">
              <span className="text-muted-foreground">Netto</span>
              <span>{formatCentsAsEuro(quote.net_total_cents)}</span>
            </div>
            <div className="flex w-56 justify-between">
              <span className="text-muted-foreground">MwSt ({quote.tax_rate} %)</span>
              <span>{formatCentsAsEuro(quote.tax_total_cents)}</span>
            </div>
            <div className="flex w-56 justify-between text-base font-semibold">
              <span>Brutto</span>
              <span>{formatCentsAsEuro(quote.gross_total_cents)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {quote.unmatched_items && quote.unmatched_items.length > 0 && (
        <Card className="max-w-3xl border-amber-500/40">
          <CardHeader>
            <CardTitle>Nicht zugeordnete Arbeiten</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <p className="text-muted-foreground">
              Diese aus der Beschreibung erkannten Arbeiten hatten keine passende Katalog-Position und wurden
              NICHT automatisch mit Preis angelegt. Bitte bei Bedarf manuell als Position ergänzen.
            </p>
            {quote.unmatched_items.map((u, i) => (
              <div key={i} className="rounded-md bg-amber-500/10 px-3 py-2">
                <p className="font-medium">{u.beschreibung}</p>
                {u.hinweis && <p className="text-xs text-muted-foreground">{u.hinweis}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {quote.is_ai_generated && quote.intake_description && (
        <Card className="max-w-3xl">
          <CardHeader>
            <CardTitle>Vor-Ort-Aufnahme (Grundlage des KI-Entwurfs)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <p className="whitespace-pre-wrap">{quote.intake_description}</p>
            {quote.intake_rooms && quote.intake_rooms.length > 0 && (
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Räume/Maße</span>
                {quote.intake_rooms.map((r, i) => (
                  <p key={i} className="text-muted-foreground">
                    {r.name}: {r.length} m × {r.width} m × {r.height} m, Anzahl {r.count} (Fläche je Raum{" "}
                    {r.areaM2} m²)
                  </p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
