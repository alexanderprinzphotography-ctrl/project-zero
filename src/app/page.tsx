import { redirect } from "next/navigation";
import { getUserContext } from "@/core/auth/get-user-context";
import { createClient } from "@/core/supabase/server";
import { OnboardingChecklist, type OnboardingItem } from "@/core/ui/onboarding-checklist";
import { PageHeader } from "@/core/ui/page-header";
import { AdminOverview } from "./admin-overview";
import { EmployeeOverview } from "./employee-overview";

function formatTodayLong(): string {
  return new Date().toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function Home() {
  const context = await getUserContext();
  if (!context) redirect("/login");

  const supabase = await createClient();
  const [{ count: contactCount }, { count: projectCount }, { count: catalogCount }] = await Promise.all([
    supabase.from("contacts").select("id", { count: "exact", head: true }),
    supabase.from("projects").select("id", { count: "exact", head: true }),
    supabase.from("catalog_items").select("id", { count: "exact", head: true }),
  ]);

  const items: OnboardingItem[] = [
    {
      key: "branding",
      label: "Corporate Design einrichten (Logo, Farben)",
      done: Boolean(context.logoUrl || context.primaryColor || context.accentColor),
      href: "/einstellungen",
    },
    {
      key: "customer",
      label: "Ersten Kunden anlegen",
      done: (contactCount ?? 0) > 0,
      href: "/kunden/neu",
    },
    {
      key: "project",
      label: "Erste Baustelle anlegen",
      done: (projectCount ?? 0) > 0,
      href: "/projekte/neu",
    },
    {
      key: "catalog",
      label: "Leistungskatalog befüllen",
      done: (catalogCount ?? 0) > 0,
      href: "/leistungskatalog",
    },
  ];

  const isAdminOrPL = ["admin", "projektleiter"].includes(context.role);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`Willkommen${context.fullName ? `, ${context.fullName}` : ""}`}
        description={formatTodayLong()}
      />
      <OnboardingChecklist items={items} />
      {isAdminOrPL ? <AdminOverview isWritable={context.isWritable} /> : <EmployeeOverview />}
    </div>
  );
}
