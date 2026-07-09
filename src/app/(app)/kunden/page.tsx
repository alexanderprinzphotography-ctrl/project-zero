import Link from "next/link";
import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/core/ui/empty-state";
import { FilterBar, FilterField } from "@/core/ui/filter-bar";
import { ListContainer, ListRow } from "@/core/ui/list";
import { PageHeader } from "@/core/ui/page-header";
import { createClient } from "@/core/supabase/server";
import { getUserContext } from "@/core/auth/get-user-context";
import { contactDisplayName, contactTypeLabel, type Contact } from "@/core/crm/contact";

function escapeOrFilterValue(value: string): string {
  // Kommas/Prozentzeichen wuerden die PostgREST-Filter-Syntax stoeren.
  return value.replace(/[,%]/g, "");
}

export default async function KundenPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; archived?: string }>;
}) {
  const { q, type, archived } = await searchParams;
  const context = await getUserContext();
  if (!context) redirect("/login");

  const canWrite = ["admin", "projektleiter"].includes(context.role) && context.isWritable;
  const canSeeWriteButtons = ["admin", "projektleiter"].includes(context.role);

  const supabase = await createClient();
  let query = supabase.from("contacts").select("*").order("customer_number", { ascending: true });

  if (archived !== "1") {
    query = query.eq("is_archived", false);
  }
  if (type === "privat" || type === "gewerblich") {
    query = query.eq("type", type);
  }

  const term = escapeOrFilterValue((q ?? "").trim());
  if (term) {
    const orParts = [
      `company_name.ilike.%${term}%`,
      `first_name.ilike.%${term}%`,
      `last_name.ilike.%${term}%`,
      `email.ilike.%${term}%`,
      `phone.ilike.%${term}%`,
      `mobile.ilike.%${term}%`,
    ];
    if (/^\d+$/.test(term)) {
      orParts.push(`customer_number.eq.${term}`);
    }
    query = query.or(orParts.join(","));
  }

  const { data } = await query;
  const contacts = (data as Contact[] | null) ?? [];
  const hasFilters = Boolean(q || type || archived === "1");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Kunden"
        description={`Kundenstamm von ${context.companyName}.`}
        actions={
          canSeeWriteButtons ? (
            canWrite ? (
              <Link href="/kunden/neu">
                <Button>Neuer Kunde</Button>
              </Link>
            ) : (
              <Button disabled title="Testphase abgelaufen – Anlegen ist gesperrt.">
                Neuer Kunde
              </Button>
            )
          ) : undefined
        }
      />

      <FilterBar method="get">
        <FilterField label="Suche" htmlFor="q">
          <Input
            id="q"
            name="q"
            type="text"
            defaultValue={q ?? ""}
            placeholder="Name, Kundennummer, E-Mail, Telefon…"
            className="w-80"
          />
        </FilterField>
        <FilterField label="Typ" htmlFor="type">
          <select
            id="type"
            name="type"
            defaultValue={type ?? "all"}
            className="h-10 rounded-md border border-input bg-transparent px-3 text-sm"
          >
            <option value="all">Alle</option>
            <option value="privat">Privat</option>
            <option value="gewerblich">Gewerblich</option>
          </select>
        </FilterField>
        <label className="flex items-center gap-1.5 pb-2.5 text-sm">
          <input type="checkbox" name="archived" value="1" defaultChecked={archived === "1"} />
          Archivierte anzeigen
        </label>
        <Button type="submit" variant="outline">
          Filtern
        </Button>
      </FilterBar>

      {contacts.length === 0 ? (
        <EmptyState
          icon={Users}
          title={hasFilters ? "Keine Kunden für diese Filter." : "Noch keine Kunden."}
          action={
            canWrite && !hasFilters ? (
              <Link href="/kunden/neu">
                <Button size="sm">Ersten Kunden anlegen</Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <ListContainer>
          {contacts.map((contact) => (
            <ListRow key={contact.id} href={`/kunden/${contact.id}`}>
              <div className="grid w-full grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-4">
                <div className="min-w-0">
                  <span className="font-medium">
                    #{contact.customer_number} · {contactDisplayName(contact)}
                  </span>
                  {contact.is_archived && (
                    <span className="ml-2 text-xs text-muted-foreground">(archiviert)</span>
                  )}
                </div>
                <span className="truncate text-sm text-muted-foreground">
                  {contactTypeLabel(contact.type)}
                </span>
                <span className="truncate text-sm text-muted-foreground">{contact.city ?? "–"}</span>
                <span className="truncate text-sm text-muted-foreground">
                  {contact.email ?? contact.phone ?? contact.mobile ?? "–"}
                </span>
              </div>
            </ListRow>
          ))}
        </ListContainer>
      )}
    </div>
  );
}
