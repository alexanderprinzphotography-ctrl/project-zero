import { redirect } from "next/navigation";
import { getUserContext } from "@/core/auth/get-user-context";
import { DEFAULT_ACCENT_COLOR, DEFAULT_PRIMARY_COLOR } from "@/core/theme/defaults";
import { ThemeSettingsForm } from "./theme-settings-form";
import { ProjectVisibilityForm } from "./project-visibility-form";
import { ScheduleVisibilityForm } from "./schedule-visibility-form";

export default async function EinstellungenPage() {
  const context = await getUserContext();

  if (!context) redirect("/");
  if (context.role !== "admin") redirect("/");

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Einstellungen</h1>
        <p className="mt-1 text-muted-foreground">
          Logo, Markenfarben und Projekt-Sichtbarkeit von {context.companyName}.
        </p>
      </div>
      <ThemeSettingsForm
        initialPrimary={context.primaryColor ?? DEFAULT_PRIMARY_COLOR}
        initialAccent={context.accentColor ?? DEFAULT_ACCENT_COLOR}
        initialLogoUrl={context.logoUrl}
        readOnly={!context.isWritable}
      />
      <div className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold tracking-tight">Projekt-Sichtbarkeit</h2>
        <ProjectVisibilityForm
          initialValue={context.projectVisibility}
          readOnly={!context.isWritable}
        />
      </div>
      <div className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold tracking-tight">Planungs-Sichtbarkeit</h2>
        <ScheduleVisibilityForm
          initialValue={context.scheduleVisibility}
          readOnly={!context.isWritable}
        />
      </div>
    </div>
  );
}
