import Link from "next/link";
import { redirect } from "next/navigation";
import { getUserContext } from "@/core/auth/get-user-context";
import { PageHeader } from "@/core/ui/page-header";
import { handwerkProjectFields } from "@/modules/handwerk/project-fields";
import { ProjectForm } from "../project-form";
import { getCustomerOptions } from "../customer-options";
import { createProject } from "../actions";

export default async function NeuesProjektPage() {
  const context = await getUserContext();
  if (!context) redirect("/login");
  if (!["admin", "projektleiter"].includes(context.role)) redirect("/projekte");

  const customers = await getCustomerOptions();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Neues Projekt" />
      {context.isWritable ? (
        <ProjectForm
          customers={customers}
          handwerkFields={handwerkProjectFields}
          action={createProject}
          submitLabel="Projekt anlegen"
        />
      ) : (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Testphase abgelaufen – Neuanlage ist gesperrt.{" "}
          <Link href="/projekte" className="underline">
            Zurück zur Projektliste
          </Link>
        </p>
      )}
    </div>
  );
}
