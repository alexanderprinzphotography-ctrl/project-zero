import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FilterBar, FilterField } from "@/core/ui/filter-bar";
import { PageHeader } from "@/core/ui/page-header";
import { createClient } from "@/core/supabase/server";
import { getUserContext } from "@/core/auth/get-user-context";
import { formatDurationHM, netSeconds } from "@/core/time/entry";

type EvaluationRow = {
  id: string;
  project_id: string;
  user_id: string;
  started_at: string;
  ended_at: string;
  break_minutes: number;
  projects: { title: string } | null;
  profiles: { full_name: string | null; email: string | null } | null;
};

export default async function ZeitAuswertungPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = await searchParams;
  const context = await getUserContext();
  if (!context) redirect("/login");
  if (!["admin", "projektleiter"].includes(context.role)) redirect("/zeiten");

  const supabase = await createClient();

  // time_entries hat mehrere Fremdschluessel auf profiles (user_id, created_by,
  // updated_by) - expliziter Hint noetig, sonst PGRST201 (siehe project_members).
  let query = supabase
    .from("time_entries")
    .select(
      "id, project_id, user_id, started_at, ended_at, break_minutes, projects(title), profiles!time_entries_user_id_fkey(full_name, email)",
    )
    .not("ended_at", "is", null); // nur abgeschlossene Eintraege in die Auswertung

  if (from) {
    query = query.gte("started_at", new Date(`${from}T00:00:00`).toISOString());
  }
  if (to) {
    const toExclusive = new Date(`${to}T00:00:00`);
    toExclusive.setDate(toExclusive.getDate() + 1);
    query = query.lt("started_at", toExclusive.toISOString());
  }

  const { data } = await query;
  const rows = (data as unknown as EvaluationRow[] | null) ?? [];

  // Immer aus den exakten Sekundenwerten summieren, NIE aus bereits auf HH:MM
  // gerundeten Einzelwerten - sonst stimmt die Summe nicht exakt.
  const perProject = new Map<string, { label: string; seconds: number }>();
  const perUser = new Map<string, { label: string; seconds: number }>();
  let totalSeconds = 0;

  for (const row of rows) {
    const seconds = netSeconds(row.started_at, row.ended_at, row.break_minutes);
    totalSeconds += seconds;

    const projectLabel = row.projects?.title ?? "Unbekannt";
    const projectEntry = perProject.get(row.project_id) ?? { label: projectLabel, seconds: 0 };
    projectEntry.seconds += seconds;
    perProject.set(row.project_id, projectEntry);

    const userLabel = row.profiles?.full_name || row.profiles?.email || "Unbekannt";
    const userEntry = perUser.get(row.user_id) ?? { label: userLabel, seconds: 0 };
    userEntry.seconds += seconds;
    perUser.set(row.user_id, userEntry);
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Auswertung" description="Netto-Zeit, exakt (keine Rundung vor der Summe)." />

      <FilterBar method="get">
        <FilterField label="Von" htmlFor="from">
          <Input id="from" name="from" type="date" defaultValue={from ?? ""} />
        </FilterField>
        <FilterField label="Bis" htmlFor="to">
          <Input id="to" name="to" type="date" defaultValue={to ?? ""} />
        </FilterField>
        <Button type="submit" variant="outline">
          Filtern
        </Button>
      </FilterBar>

      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Gesamt</CardTitle>
        </CardHeader>
        <CardContent className="text-2xl font-semibold">{formatDurationHM(totalSeconds)}</CardContent>
      </Card>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Pro Projekt</CardTitle>
        </CardHeader>
        <CardContent>
          {perProject.size === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Einträge im gewählten Zeitraum.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {Array.from(perProject.entries()).map(([projectId, entry]) => (
                  <tr key={projectId} className="border-b border-border last:border-0">
                    <td className="py-2">{entry.label}</td>
                    <td className="py-2 text-right font-medium">{formatDurationHM(entry.seconds)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Pro Mitarbeiter</CardTitle>
        </CardHeader>
        <CardContent>
          {perUser.size === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Einträge im gewählten Zeitraum.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {Array.from(perUser.entries()).map(([userId, entry]) => (
                  <tr key={userId} className="border-b border-border last:border-0">
                    <td className="py-2">{entry.label}</td>
                    <td className="py-2 text-right font-medium">{formatDurationHM(entry.seconds)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
