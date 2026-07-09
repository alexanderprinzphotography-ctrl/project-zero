import { redirect } from "next/navigation";
import { NarrowContainer } from "@/core/ui/narrow-container";
import { PageHeader } from "@/core/ui/page-header";
import { createClient } from "@/core/supabase/server";
import { getUserContext } from "@/core/auth/get-user-context";
import { createQuote } from "../actions";
import { QuoteHeaderForm } from "../quote-header-form";

export default async function NeuesAngebotPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string; projectId?: string }>;
}) {
  const { customerId, projectId } = await searchParams;
  const context = await getUserContext();
  if (!context) redirect("/login");
  if (!["admin", "projektleiter"].includes(context.role)) redirect("/");
  if (!context.isWritable) redirect("/angebote");

  const supabase = await createClient();
  const { data: customers } = await supabase
    .from("contacts")
    .select("id, type, company_name, first_name, last_name")
    .eq("is_archived", false)
    .order("created_at", { ascending: true });
  const { data: projects } = await supabase
    .from("projects")
    .select("id, title")
    .eq("is_archived", false)
    .order("title", { ascending: true });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Neues Angebot" />
      <NarrowContainer>
        <QuoteHeaderForm
          defaultCustomerId={customerId}
          defaultProjectId={projectId}
          customers={customers ?? []}
          projects={projects ?? []}
          action={createQuote}
          submitLabel="Angebot anlegen"
        />
      </NarrowContainer>
    </div>
  );
}
