import { redirect } from "next/navigation";
import { getUserContext } from "@/core/auth/get-user-context";
import { createClient } from "@/core/supabase/server";
import { PageHeader } from "@/core/ui/page-header";
import { NarrowContainer } from "@/core/ui/narrow-container";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { DEFAULT_ACCENT_COLOR, DEFAULT_PRIMARY_COLOR } from "@/core/theme/defaults";
import { ThemeSettingsForm } from "./theme-settings-form";
import { ProjectVisibilityForm } from "./project-visibility-form";
import { ScheduleVisibilityForm } from "./schedule-visibility-form";
import { AutoReleaseForm } from "./auto-release-form";
import { IntegrationForm } from "./integration-form";

type IntegrationRow = {
  status: "ok" | "error";
  last_error: string | null;
  key_last4: string;
  connected_at: string;
};

export default async function EinstellungenPage() {
  const context = await getUserContext();

  if (!context) redirect("/");
  if (context.role !== "admin") redirect("/");

  const supabase = await createClient();
  const { data: integration } = await supabase
    .from("company_integrations")
    .select("status, last_error, key_last4, connected_at")
    .eq("provider", "sevdesk")
    .maybeSingle<IntegrationRow>();

  return (
    <NarrowContainer className="flex flex-col gap-6">
      <PageHeader
        title="Einstellungen"
        description={`Logo, Markenfarben und Projekt-Sichtbarkeit von ${context.companyName}.`}
      />
      <Card>
        <CardHeader>
          <CardTitle>Corporate Design</CardTitle>
        </CardHeader>
        <CardContent>
          <ThemeSettingsForm
            initialPrimary={context.primaryColor ?? DEFAULT_PRIMARY_COLOR}
            initialAccent={context.accentColor ?? DEFAULT_ACCENT_COLOR}
            initialLogoUrl={context.logoUrl}
            readOnly={!context.isWritable}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Projekt-Sichtbarkeit</CardTitle>
        </CardHeader>
        <CardContent>
          <ProjectVisibilityForm
            initialValue={context.projectVisibility}
            readOnly={!context.isWritable}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Planungs-Sichtbarkeit</CardTitle>
        </CardHeader>
        <CardContent>
          <ScheduleVisibilityForm
            initialValue={context.scheduleVisibility}
            readOnly={!context.isWritable}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Angebote – Auto-Freigabe</CardTitle>
        </CardHeader>
        <CardContent>
          <AutoReleaseForm
            initialEnabled={context.autoReleaseEnabled}
            initialLimitCents={context.autoReleaseLimitCents}
            readOnly={!context.isWritable}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Buchhaltung / Rechnungen</CardTitle>
        </CardHeader>
        <CardContent>
          <IntegrationForm
            connected={Boolean(integration)}
            status={integration?.status ?? null}
            lastError={integration?.last_error ?? null}
            keyLast4={integration?.key_last4 ?? null}
            connectedAt={integration?.connected_at ?? null}
            readOnly={!context.isWritable}
          />
        </CardContent>
      </Card>
    </NarrowContainer>
  );
}
