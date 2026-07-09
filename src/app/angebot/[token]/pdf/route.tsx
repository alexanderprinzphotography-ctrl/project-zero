import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/core/supabase/server";
import { QuotePdfDocument } from "@/core/quotes/quote-pdf";
import type { Quote, QuoteItem } from "@/core/quotes/quote";
import type { QuoteShareData, QuoteShareItem } from "@/core/quotes/quote-share";

/**
 * Oeffentlicher PDF-Proxy (MS 12a) - dieselbe QuotePdfDocument-Komponente wie
 * intern (angebote/[id]/pdf/route.tsx), kein eigenes Rendering. Quote-Felder,
 * die die Komponente nachweislich nicht liest (id, customer_id, ...), werden
 * mit neutralen Platzhaltern gefuellt, um die geteilte Komponente unveraendert
 * zu lassen - die RPC liefert bewusst keine internen IDs.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();

  const { data: share } = await supabase
    .rpc("get_quote_share", { p_token: token })
    .single<QuoteShareData>();

  if (!share || !share.valid) {
    return new NextResponse("Link ungültig oder abgelaufen", { status: 404 });
  }

  const { data: itemRows } = await supabase.rpc("get_quote_share_items", { p_token: token });
  const shareItems = (itemRows as QuoteShareItem[] | null) ?? [];

  const quote: Quote = {
    id: "",
    quote_number: share.quote_number,
    customer_id: "",
    project_id: null,
    status: share.status,
    quote_date: share.quote_date,
    valid_until: share.valid_until,
    tax_rate: share.tax_rate,
    intro_text: share.intro_text,
    closing_text: share.closing_text,
    net_total_cents: share.net_total_cents,
    tax_total_cents: share.tax_total_cents,
    gross_total_cents: share.gross_total_cents,
    created_by: "",
    approved_by: null,
    approved_at: null,
    is_ai_generated: false,
    intake_description: null,
    intake_rooms: null,
    unmatched_items: null,
  };

  const items: QuoteItem[] = shareItems.map((item) => ({
    id: "",
    quote_id: "",
    position: item.position,
    catalog_item_id: null,
    name: item.name,
    unit: item.unit,
    quantity: item.quantity,
    unit_price_net_cents: item.unit_price_net_cents,
    line_total_net_cents: item.line_total_net_cents,
    is_ai_suggested: false,
    ai_note: null,
  }));

  const pdfBuffer = await renderToBuffer(
    <QuotePdfDocument
      quote={quote}
      items={items}
      customer={share.customer}
      company={{
        name: share.company_name,
        logoUrl: share.logo_url,
        primaryColor: share.primary_color,
      }}
    />,
  );

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Angebot-${share.quote_number}.pdf"`,
    },
  });
}
