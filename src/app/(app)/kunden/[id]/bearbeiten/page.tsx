import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/core/supabase/server";
import { getUserContext } from "@/core/auth/get-user-context";
import { NarrowContainer } from "@/core/ui/narrow-container";
import { PageHeader } from "@/core/ui/page-header";
import type { Contact } from "@/core/crm/contact";
import { ContactForm } from "../../contact-form";
import { updateContact } from "../../actions";

export default async function KundeBearbeitenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const context = await getUserContext();
  if (!context) redirect("/login");
  if (!["admin", "projektleiter"].includes(context.role)) redirect(`/kunden/${id}`);

  const supabase = await createClient();
  const { data: contact } = await supabase
    .from("contacts")
    .select("*")
    .eq("id", id)
    .maybeSingle<Contact>();

  if (!contact) notFound();

  const boundUpdate = updateContact.bind(null, id);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`Kunde #${contact.customer_number} bearbeiten`} />
      <NarrowContainer>
        {context.isWritable ? (
          <ContactForm contact={contact} action={boundUpdate} submitLabel="Änderungen speichern" />
        ) : (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Testphase abgelaufen – Bearbeiten ist gesperrt.{" "}
            <Link href={`/kunden/${id}`} className="underline">
              Zurück zur Detailansicht
            </Link>
          </p>
        )}
      </NarrowContainer>
    </div>
  );
}
