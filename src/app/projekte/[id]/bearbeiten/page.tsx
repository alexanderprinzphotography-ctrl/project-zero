import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/core/supabase/server";
import { getUserContext } from "@/core/auth/get-user-context";
import { NarrowContainer } from "@/core/ui/narrow-container";
import { PageHeader } from "@/core/ui/page-header";
import type { Project } from "@/core/projects/project";
import { handwerkProjectFields } from "@/modules/handwerk/project-fields";
import { ProjectForm } from "../../project-form";
import { getCustomerOptions } from "../../customer-options";
import { updateProject } from "../../actions";

export default async function ProjektBearbeitenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const context = await getUserContext();
  if (!context) redirect("/login");
  if (!["admin", "projektleiter"].includes(context.role)) redirect(`/projekte/${id}`);

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .maybeSingle<Project>();

  if (!project) notFound();

  const customers = await getCustomerOptions();
  const boundUpdate = updateProject.bind(null, id);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={`Projekt #${project.project_number} bearbeiten`} />
      <NarrowContainer>
        {context.isWritable ? (
          <ProjectForm
            project={project}
            customers={customers}
            handwerkFields={handwerkProjectFields}
            action={boundUpdate}
            submitLabel="Änderungen speichern"
          />
        ) : (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Testphase abgelaufen – Bearbeiten ist gesperrt.{" "}
            <Link href={`/projekte/${id}`} className="underline">
              Zurück zur Detailansicht
            </Link>
          </p>
        )}
      </NarrowContainer>
    </div>
  );
}
