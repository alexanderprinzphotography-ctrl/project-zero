import Link from "next/link";
import { redirect } from "next/navigation";
import { getUserContext } from "@/core/auth/get-user-context";
import { PageHeader } from "@/core/ui/page-header";
import { ContactForm } from "../contact-form";
import { createContact } from "../actions";

export default async function NeuerKundePage() {
  const context = await getUserContext();
  if (!context) redirect("/login");
  if (!["admin", "projektleiter"].includes(context.role)) redirect("/kunden");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Neuer Kunde" />
      {context.isWritable ? (
        <ContactForm action={createContact} submitLabel="Kunde anlegen" />
      ) : (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Testphase abgelaufen – Neuanlage ist gesperrt.{" "}
          <Link href="/kunden" className="underline">
            Zurück zur Kundenliste
          </Link>
        </p>
      )}
    </div>
  );
}
