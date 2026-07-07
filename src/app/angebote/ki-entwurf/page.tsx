import { redirect } from "next/navigation";
import { createClient } from "@/core/supabase/server";
import { getUserContext } from "@/core/auth/get-user-context";
import { AiIntakeForm } from "../ai-intake-form";

export default async function KiEntwurfPage({
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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Angebot mit KI erstellen</h1>
        <p className="mt-1 text-muted-foreground">
          Beschreibe die vor Ort besprochenen Arbeiten – die KI schlägt passende Katalog-Positionen mit
          geschätzten Mengen vor. Preise stammen immer aus dem Katalog, nie von der KI. Du prüfst und gibst
          den Entwurf danach wie gewohnt frei.
        </p>
      </div>
      <div className="max-w-3xl">
        <AiIntakeForm
          customers={customers ?? []}
          projects={projects ?? []}
          defaultCustomerId={customerId}
          defaultProjectId={projectId}
        />
      </div>
    </div>
  );
}
