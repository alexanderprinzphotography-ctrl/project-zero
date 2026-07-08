import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/core/ui/page-header";
import { createClient } from "@/core/supabase/server";
import { getUserContext } from "@/core/auth/get-user-context";
import { hasFeature } from "@/core/billing/entitlements";
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

  // Seiten-Ebene zusaetzlich zur Server-Action-Pruefung absichern (defense in
  // depth): wer die URL direkt aufruft, soll trotzdem einen klaren, sichtbaren
  // Sperr-Hinweis sehen statt versehentlich das Formular nutzen zu koennen.
  if (!(await hasFeature(supabase, "ki"))) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Angebot mit KI erstellen" />
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Pro-Feature</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <p className="text-muted-foreground">
              Die KI-Angebotserstellung ist Teil des Pro-Plans (im laufenden Test voll verfügbar).
              Manuelle Angebote bleiben in Basic uneingeschränkt möglich.
            </p>
            <Link href="/konto/upgrade">
              <Button>Auf Pro upgraden</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

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
      <PageHeader
        title="Angebot mit KI erstellen"
        description="Beschreibe die vor Ort besprochenen Arbeiten – die KI schlägt passende Katalog-Positionen mit geschätzten Mengen vor. Preise stammen immer aus dem Katalog, nie von der KI. Du prüfst und gibst den Entwurf danach wie gewohnt frei."
      />
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
