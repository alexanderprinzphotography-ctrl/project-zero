import { Building2, CalendarDays } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/core/ui/empty-state";
import { KpiTile } from "@/core/ui/kpi-tile";
import { ListContainer, ListRow } from "@/core/ui/list";
import { createClient } from "@/core/supabase/server";
import { getUserContext } from "@/core/auth/get-user-context";
import { addDays, getMondayOfWeek, todayDateKey } from "@/core/schedule/entry";
import { projectStatusLabel, projectStatusVariant, type ProjectStatus } from "@/core/projects/project";
import { PersonalTimerWidget } from "./zeiten/personal-timer-widget";
import type { ProjectOption } from "./zeiten/time-entry-form";

type MemberProjectRow = { projects: { id: string; title: string; status: ProjectStatus } | null };

function isoOf(dateKey: string): string {
  return new Date(`${dateKey}T00:00:00`).toISOString();
}

/** Persoenliche Uebersicht fuer mitarbeiter - bewusst KEINE Firmen-Finanzkennzahlen (siehe MS 10c Prompt). Alle Abfragen laufen unter der normalen Session, RLS filtert automatisch auf eigene Zeilen. */
export async function EmployeeOverview() {
  const context = await getUserContext();
  if (!context) return null;

  const supabase = await createClient();

  const monday = getMondayOfWeek(todayDateKey());
  const nextMonday = addDays(monday, 7);

  const [
    { data: projects },
    { data: runningTimerRow },
    { count: weekScheduleCount },
    { data: myProjectsData },
  ] = await Promise.all([
    supabase.from("projects").select("id, title").eq("is_archived", false).order("title", { ascending: true }),
    supabase
      .from("time_entries")
      .select("id, started_at, project_id, projects(title)")
      .eq("user_id", context.userId)
      .is("ended_at", null)
      .maybeSingle<{ id: string; started_at: string; project_id: string; projects: { title: string } | null }>(),
    supabase
      .from("schedule_entries")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .gte("starts_at", isoOf(monday))
      .lt("starts_at", isoOf(nextMonday)),
    supabase
      .from("project_members")
      .select("projects(id, title, status)")
      .eq("user_id", context.userId),
  ]);

  const projectOptions: ProjectOption[] = (projects ?? []).map((p) => ({ id: p.id, label: p.title }));
  const runningEntry = runningTimerRow
    ? {
        id: runningTimerRow.id,
        started_at: runningTimerRow.started_at,
        projectLabel: runningTimerRow.projects?.title ?? "Unbekannt",
      }
    : null;

  const myProjects = ((myProjectsData as unknown as MemberProjectRow[] | null) ?? [])
    .map((row) => row.projects)
    .filter((p): p is NonNullable<typeof p> => p !== null);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <KpiTile icon={CalendarDays} label="Meine Einsätze diese Woche" value={String(weekScheduleCount ?? 0)} />
        <KpiTile icon={Building2} label="Zugewiesene Baustellen" value={String(myProjects.length)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Zeit erfassen</CardTitle>
        </CardHeader>
        <CardContent>
          <PersonalTimerWidget projectOptions={projectOptions} runningEntry={runningEntry} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Meine Baustellen</CardTitle>
        </CardHeader>
        <CardContent>
          {myProjects.length === 0 ? (
            <EmptyState icon={Building2} title="Dir sind noch keine Baustellen zugewiesen." />
          ) : (
            <ListContainer>
              {myProjects.map((p) => (
                <ListRow key={p.id} href={`/projekte/${p.id}`}>
                  <span>{p.title}</span>
                  <Badge variant={projectStatusVariant(p.status)}>{projectStatusLabel(p.status)}</Badge>
                </ListRow>
              ))}
            </ListContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
