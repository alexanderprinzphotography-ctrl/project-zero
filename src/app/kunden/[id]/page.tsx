import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/core/ui/page-header";
import { createClient } from "@/core/supabase/server";
import { getUserContext } from "@/core/auth/get-user-context";
import { contactDisplayName, contactTypeLabel, type Contact } from "@/core/crm/contact";
import { ArchiveToggleButton } from "./archive-toggle-button";
import { QuoteListSection } from "@/app/angebote/quote-list-section";

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
}

export default async function KundeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const context = await getUserContext();
  if (!context) redirect("/login");

  const supabase = await createClient();
  const { data: contact } = await supabase
    .from("contacts")
    .select("*")
    .eq("id", id)
    .maybeSingle<Contact>();

  if (!contact) notFound();

  const canEdit = ["admin", "projektleiter"].includes(context.role) && context.isWritable;
  const canSeeActions = ["admin", "projektleiter"].includes(context.role);
  const address = [contact.street, [contact.postal_code, contact.city].filter(Boolean).join(" "), contact.country]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${contactDisplayName(contact)}${contact.is_archived ? " (archiviert)" : ""}`}
        description={`Kunde #${contact.customer_number} · ${contactTypeLabel(contact.type)}`}
        actions={
          canSeeActions ? (
            <>
              {canEdit && (
                <Link href={`/kunden/${contact.id}/bearbeiten`}>
                  <Button size="sm" variant="outline">
                    Bearbeiten
                  </Button>
                </Link>
              )}
              <ArchiveToggleButton id={contact.id} isArchived={contact.is_archived} />
            </>
          ) : undefined
        }
      />

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Kontaktdaten</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4">
            <Field label="E-Mail" value={contact.email} />
            <Field label="Telefon" value={contact.phone} />
            <Field label="Mobil" value={contact.mobile} />
            <Field label="Adresse" value={address || null} />
            <Field label="USt-IdNr." value={contact.vat_id} />
          </dl>
          {contact.notes && (
            <div className="mt-4">
              <dt className="text-xs text-muted-foreground">Notizen</dt>
              <dd className="whitespace-pre-wrap text-sm">{contact.notes}</dd>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Verknüpfte Projekte</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Projekte werden in einem späteren Meilenstein mit Kunden verknüpft.
        </CardContent>
      </Card>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Angebote</CardTitle>
        </CardHeader>
        <CardContent>
          <QuoteListSection
            customerId={contact.id}
            canView={["admin", "projektleiter"].includes(context.role)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
