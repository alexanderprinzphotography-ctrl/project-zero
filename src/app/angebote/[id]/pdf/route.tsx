import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/core/supabase/server";
import { getUserContext } from "@/core/auth/get-user-context";
import { QuotePdfDocument, type QuotePdfCustomer } from "@/core/quotes/quote-pdf";
import type { Quote, QuoteItem } from "@/core/quotes/quote";

type QuoteWithCustomer = Quote & { contacts: QuotePdfCustomer | null };

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await getUserContext();
  if (!context || !["admin", "projektleiter"].includes(context.role)) {
    return new NextResponse("Nicht berechtigt", { status: 403 });
  }

  const supabase = await createClient();
  const { data: quote } = await supabase
    .from("quotes")
    .select("*, contacts(type, company_name, first_name, last_name, street, postal_code, city, country)")
    .eq("id", id)
    .maybeSingle<QuoteWithCustomer>();

  if (!quote) {
    return new NextResponse("Angebot nicht gefunden", { status: 404 });
  }

  const { data: itemRows } = await supabase
    .from("quote_items")
    .select(
      "id, quote_id, position, catalog_item_id, name, unit, quantity, unit_price_net_cents, line_total_net_cents, is_ai_suggested, ai_note",
    )
    .eq("quote_id", id)
    .order("position", { ascending: true });

  const pdfBuffer = await renderToBuffer(
    <QuotePdfDocument
      quote={quote}
      items={(itemRows as QuoteItem[] | null) ?? []}
      customer={
        quote.contacts ?? {
          type: "privat",
          company_name: null,
          first_name: null,
          last_name: null,
          street: null,
          postal_code: null,
          city: null,
          country: "DE",
        }
      }
      company={{
        name: context.companyName,
        logoUrl: context.logoUrl,
        primaryColor: context.primaryColor,
      }}
    />,
  );

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Angebot-${quote.quote_number}.pdf"`,
    },
  });
}
