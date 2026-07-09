import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/core/supabase/server";
import { brandCssVars } from "@/core/theme/brand-style";
import { contactDisplayName } from "@/core/crm/contact";
import { formatCentsAsEuro } from "@/core/money/cents";
import { quoteStatusLabel, quoteStatusVariant } from "@/core/quotes/quote";
import { projectStatusLabel, projectStatusVariant } from "@/core/projects/project";
import { canRespondToQuoteShare, type QuoteShareData, type QuoteShareItem } from "@/core/quotes/quote-share";
import { QuoteResponseForm } from "./quote-response-form";

export const metadata: Metadata = {
  title: "Angebot",
  robots: { index: false, follow: false },
};

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("de-DE");
}

function InvalidLinkCard() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Link ungültig oder abgelaufen</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Dieser Link ist nicht (mehr) gültig. Bitte wende dich an den Betrieb, der ihn dir geschickt hat.
        </CardContent>
      </Card>
    </div>
  );
}

export default async function QuoteSharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();

  const { data: share } = await supabase
    .rpc("get_quote_share", { p_token: token })
    .single<QuoteShareData>();

  if (!share || !share.valid) {
    return <InvalidLinkCard />;
  }

  const { data: itemRows } = await supabase.rpc("get_quote_share_items", { p_token: token });
  const items = (itemRows as QuoteShareItem[] | null) ?? [];

  const brandStyle = brandCssVars({ primaryColor: share.primary_color, accentColor: share.accent_color });
  const canRespond = canRespondToQuoteShare(share);

  return (
    <div style={brandStyle as CSSProperties} className="min-h-screen bg-muted/30">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-4 sm:p-8">
        <div className="flex items-center gap-3">
          {share.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- externe Supabase-Storage-URL
            <img
              src={share.logo_url}
              alt={`${share.company_name} Logo`}
              className="h-10 w-10 rounded object-contain"
            />
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
              {share.company_name.slice(0, 2).toUpperCase()}
            </span>
          )}
          <span className="font-heading text-lg font-semibold">{share.company_name}</span>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>Angebot #{share.quote_number}</CardTitle>
              <Badge variant={quoteStatusVariant(share.status)}>{quoteStatusLabel(share.status)}</Badge>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Angebotsdatum</dt>
                <dd>{formatDate(share.quote_date)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Gültig bis</dt>
                <dd>{formatDate(share.valid_until)}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs text-muted-foreground">Für</dt>
                <dd>{contactDisplayName(share.customer)}</dd>
              </div>
            </dl>

            {share.intro_text && <p className="whitespace-pre-wrap text-sm">{share.intro_text}</p>}

            <div className="flex flex-col gap-2">
              {items.map((item) => (
                <div
                  key={item.position}
                  className="flex items-center justify-between gap-4 border-b border-border py-2 text-sm last:border-0"
                >
                  <div className="min-w-0">
                    <span className="font-medium">{item.name}</span>{" "}
                    <span className="text-muted-foreground">
                      ({item.quantity} {item.unit})
                    </span>
                  </div>
                  <span className="shrink-0 font-medium">
                    {formatCentsAsEuro(item.line_total_net_cents)}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex flex-col items-end gap-1 border-t border-border pt-4 text-sm">
              <div className="flex w-56 justify-between">
                <span className="text-muted-foreground">Netto</span>
                <span>{formatCentsAsEuro(share.net_total_cents)}</span>
              </div>
              <div className="flex w-56 justify-between">
                <span className="text-muted-foreground">MwSt ({share.tax_rate} %)</span>
                <span>{formatCentsAsEuro(share.tax_total_cents)}</span>
              </div>
              <div className="flex w-56 justify-between text-base font-semibold">
                <span>Brutto</span>
                <span>{formatCentsAsEuro(share.gross_total_cents)}</span>
              </div>
            </div>

            {share.closing_text && (
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{share.closing_text}</p>
            )}

            <a href={`/angebot/${token}/pdf`} target="_blank" rel="noreferrer" className="w-fit">
              <Button type="button" variant="outline" size="sm">
                PDF herunterladen
              </Button>
            </a>
          </CardContent>
        </Card>

        {share.project && (
          <Card>
            <CardHeader>
              <CardTitle>Projektfortschritt</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div className="col-span-2">
                  <dt className="text-xs text-muted-foreground">Projekt</dt>
                  <dd className="flex items-center gap-2">
                    {share.project.title}
                    <Badge variant={projectStatusVariant(share.project.status)}>
                      {projectStatusLabel(share.project.status)}
                    </Badge>
                  </dd>
                </div>
                {share.project.start_date && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Start</dt>
                    <dd>{formatDate(share.project.start_date)}</dd>
                  </div>
                )}
                {share.project.planned_end_date && (
                  <div>
                    <dt className="text-xs text-muted-foreground">Geplantes Ende</dt>
                    <dd>{formatDate(share.project.planned_end_date)}</dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Rückmeldung</CardTitle>
          </CardHeader>
          <CardContent>
            {share.response ? (
              <p className="text-sm">
                Angebot{" "}
                <strong>{share.response.action === "angenommen" ? "angenommen" : "abgelehnt"}</strong> am{" "}
                {formatDate(share.response.responded_at)} von {share.response.responder_name}.
              </p>
            ) : canRespond ? (
              <QuoteResponseForm token={token} />
            ) : (
              <p className="text-sm text-muted-foreground">
                Dieses Angebot kann derzeit nicht mehr angenommen oder abgelehnt werden.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
