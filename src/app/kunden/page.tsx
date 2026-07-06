import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Kunden</h1>
          <p className="mt-1 text-muted-foreground">Kundenstamm von {context.companyName}.</p>
        </div>
        {canSeeWriteButtons &&
          (canWrite ? (
            <Link href="/kunden/neu">
              <Button>Neuer Kunde</Button>
            </Link>
          ) : (
            <Button disabled title="Testphase abgelaufen – Anlegen ist gesperrt.">
              Neuer Kunde
            </Button>
          ))}
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="q" className="text-sm font-medium">
            Suche
          </label>
          <input
            id="q"
            name="q"
            type="text"
            defaultValue={q ?? ""}
            placeholder="Name, Kundennummer, E-Mail, Telefon…"
            className="w-64 rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="type" className="text-sm font-medium">
            Typ
          </label>
          <select
            id="type"
            name="type"
            defaultValue={type ?? "all"}
            className="rounded-md border border-input bg-transparent px-3 py-2 text-sm"
          >
            <option value="all">Alle</option>
            <option value="privat">Privat</option>
            <option value="gewerblich">Gewerblich</option>
          </select>
        </div>
        <label className="flex items-center gap-1.5 pb-2 text-sm">
          <input type="checkbox" name="archived" value="1" defaultChecked={archived === "1"} />
          Archivierte anzeigen
        </label>
        <Button type="submit" variant="outline">
          Filtern
        </Button>
      </form>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="py-2 font-medium">Nr.</th>
            <th className="py-2 font-medium">Name</th>
            <th className="py-2 font-medium">Typ</th>
            <th className="py-2 font-medium">Ort</th>
            <th className="py-2 font-medium">Kontakt</th>
          </tr>
        </thead>
        <tbody>
          {contacts.map((contact) => (
            <tr key={contact.id} className="border-b border-border last:border-0 hover:bg-accent/5">
              <td className="py-2">
                <Link href={`/kunden/${contact.id}`} className="block">
                  {contact.customer_number}
                </Link>
              </td>
              <td className="py-2">
                <Link href={`/kunden/${contact.id}`} className="block hover:underline">
                  {contactDisplayName(contact)}
                  {contact.is_archived && (
                    <span className="ml-2 text-xs text-muted-foreground">(archiviert)</span>
                  )}
                </Link>
              </td>
              <td className="py-2">{contactTypeLabel(contact.type)}</td>
              <td className="py-2">{contact.city ?? "–"}</td>
              <td className="py-2">{contact.email ?? contact.phone ?? contact.mobile ?? "–"}</td>
            </tr>
          ))}
          {contacts.length === 0 && (
            <tr>
              <td colSpan={5} className="py-6 text-center text-muted-foreground">
                Keine Kunden gefunden.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
