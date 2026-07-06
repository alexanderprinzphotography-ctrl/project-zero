import { redirect } from "next/navigation";
import { getUserContext } from "@/core/auth/get-user-context";
import { DEFAULT_ACCENT_COLOR, DEFAULT_PRIMARY_COLOR } from "@/core/theme/defaults";
import { ThemeSettingsForm } from "./theme-settings-form";

export default async function EinstellungenPage() {
  const context = await getUserContext();

  if (!context) redirect("/");
  if (context.role !== "admin") redirect("/");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Einstellungen</h1>
        <p className="mt-1 text-muted-foreground">
          Logo und Markenfarben von {context.companyName}.
        </p>
      </div>
      <ThemeSettingsForm
        initialPrimary={context.primaryColor ?? DEFAULT_PRIMARY_COLOR}
        initialAccent={context.accentColor ?? DEFAULT_ACCENT_COLOR}
        initialLogoUrl={context.logoUrl}
        readOnly={!context.isWritable}
      />
    </div>
  );
}
