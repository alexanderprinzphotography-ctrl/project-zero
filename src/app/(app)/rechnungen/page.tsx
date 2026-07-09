import { redirect } from "next/navigation";
import { Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/core/ui/empty-state";
import { FilterBar, FilterField } from "@/core/ui/filter-bar";
import { ListContainer, ListRow } from "@/core/ui/list";
import { PageHeader } from "@/core/ui/page-header";
import { createClient } from "@/core/supabase/server";
import { getUserContext } from "@/core/auth/get-user-context";
import { contactDisplayName, type ContactType } from "@/core/crm/contact";
import { formatCentsAsEuro } from "@/core/money/cents";
import { invoiceStatusLabel, invoiceStatusVariant } from "@/core/invoicing/invoice-status";
import type { MirroredInvoiceStatus } from "@/core/invoicing/provider";
import { RefreshStatusButton } from "./refresh-status-button";

type InvoiceRow = {
  id: string;
  provider_invoice_number: string;
  status: MirroredInvoiceStatus;
  gross_total_cents: number;
  invoice_date: string;
  due_date: string | null;
  contacts: {
    type: ContactType;
    company_name: string | null;
    first_name: string | null;
    last_name: string | null;
  } | null;
};

const OPEN_STATUSES: MirroredInvoiceStatus[] = ["entwurf", "offen", "teilbezahlt"];

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleDateString("de-DE") : "–";
}

export default async function RechnungenPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter } = await searchParams;
  const context = await getUserContext();
  if (!context) redirect("/login");
  if (!["admin", "projektleiter"].includes(context.role)) redirect("/");

  const supabase = await createClient();
  const { data } = await supabase
    .from("invoices")
    .select(
      "id, provider_invoice_number, status, gross_total_cents, invoice_date, due_date, contacts(type, company_name, first_name, last_name)",
    )
    .order("invoice_date", { ascending: false });

  let invoices = (data as unknown as InvoiceRow[] | null) ?? [];
  if (filter === "offen") {
    invoices = invoices.filter((invoice) => OPEN_STATUSES.includes(invoice.status));
  } else if (filter === "bezahlt") {
    invoices = invoices.filter((invoice) => invoice.status === "bezahlt");
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Rechnungen"
        description="Aus sevdesk gespiegelte Rechnungen zu angenommenen Angeboten."
      />

      <FilterBar method="get">
        <FilterField label="Status" htmlFor="filter">
          <select
            id="filter"
            name="filter"
            defaultValue={filter ?? "alle"}
            className="h-10 rounded-md border border-input bg-transparent px-3 text-sm"
          >
            <option value="alle">Alle</option>
            <option value="offen">Offen</option>
            <option value="bezahlt">Bezahlt</option>
          </select>
        </FilterField>
        <Button type="submit" variant="outline" size="sm">
          Filtern
        </Button>
      </FilterBar>

      {invoices.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="Keine Rechnungen für diese Filter. Rechnungen entstehen aus angenommenen Angeboten (Angebot → „Rechnung erstellen“)."
        />
      ) : (
        <ListContainer>
          {invoices.map((invoice) => (
            <ListRow key={invoice.id}>
              <div className="grid w-full grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-4">
                <div className="min-w-0">
                  <span className="font-medium">#{invoice.provider_invoice_number}</span>{" "}
                  <span>{invoice.contacts ? contactDisplayName(invoice.contacts) : "–"}</span>
                </div>
                <span className="truncate text-sm text-muted-foreground">
                  {formatDate(invoice.invoice_date)}
                  {invoice.due_date && ` · fällig ${formatDate(invoice.due_date)}`}
                </span>
                <div className="flex items-center gap-2">
                  <Badge variant={invoiceStatusVariant(invoice.status)}>
                    {invoiceStatusLabel(invoice.status)}
                  </Badge>
                  <span className="font-medium">{formatCentsAsEuro(invoice.gross_total_cents)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <a href="https://my.sevdesk.de/" target="_blank" rel="noreferrer">
                    <Button type="button" variant="outline" size="sm">
                      In sevdesk öffnen
                    </Button>
                  </a>
                  <a href={`/rechnungen/${invoice.id}/pdf`} target="_blank" rel="noreferrer">
                    <Button type="button" variant="outline" size="sm">
                      PDF
                    </Button>
                  </a>
                  <RefreshStatusButton invoiceId={invoice.id} />
                </div>
              </div>
            </ListRow>
          ))}
        </ListContainer>
      )}
    </div>
  );
}
