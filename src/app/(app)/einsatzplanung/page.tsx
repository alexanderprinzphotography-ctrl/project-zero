import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/core/ui/page-header";
import { createClient } from "@/core/supabase/server";
import { getUserContext } from "@/core/auth/get-user-context";
import { addDays, getMondayOfWeek, todayDateKey, type ScheduleEntry } from "@/core/schedule/entry";
import { WeekGrid, type GridEntry } from "./week-grid";
import { MyScheduleList } from "./my-schedule-list";

type ScheduleEntryRow = ScheduleEntry & {
  company_id: string;
  projects: { title: string } | null;
};

function weekLink(monday: string, range: string, project: string | undefined): string {
  const params = new URLSearchParams({ week: monday, range });
  if (project) params.set("project", project);
  return `/einsatzplanung?${params.toString()}`;
}

export default async function EinsatzplanungPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; range?: string; project?: string }>;
}) {
  const { week, range, project } = await searchParams;
  const context = await getUserContext();
  if (!context) redirect("/login");

  const isAdminOrPL = ["admin", "projektleiter"].includes(context.role);
  const showTeamGrid = isAdminOrPL || context.scheduleVisibility === "team";
  const dayRange = range === "full" ? "full" : "work";
  const dayCount = dayRange === "full" ? 7 : 5;

  const monday = getMondayOfWeek(week ?? todayDateKey());
  const days = Array.from({ length: dayCount }, (_, i) => addDays(monday, i));
  const prevWeek = addDays(monday, -7);
  const nextWeek = addDays(monday, 7);

  // Grosszuegige Marge (±1 Tag in UTC) statt exakter Europe/Berlin-Grenzen -
  // die serverseitige Abfrage muss nur "genug" laden, die praezise Zuordnung
  // pro Tag passiert client-seitig im Browser (siehe entryOverlapsDay).
  const queryStart = new Date(`${addDays(monday, -1)}T00:00:00Z`).toISOString();
  const queryEnd = new Date(`${addDays(monday, dayCount + 1)}T00:00:00Z`).toISOString();

  const supabase = await createClient();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .order("created_at", { ascending: true });
  const employees = (profiles ?? []).map((p) => ({ id: p.id, label: p.full_name || p.email || p.id }));

  const { data: projectsData } = await supabase
    .from("projects")
    .select("id, title")
    .eq("is_archived", false)
    .order("title", { ascending: true });
  const projectOptions = (projectsData ?? []).map((p) => ({ id: p.id, label: p.title }));

  const { data: entryRows } = await supabase
    .from("schedule_entries")
    .select(
      "id, company_id, user_id, type, project_id, absence_kind, mode, half_day_slot, starts_at, ends_at, note, projects(title)",
    )
    .gte("starts_at", queryStart)
    .lt("starts_at", queryEnd)
    .order("starts_at", { ascending: true });

  let entries: GridEntry[] = ((entryRows as unknown as ScheduleEntryRow[] | null) ?? []).map((row) => ({
    id: row.id,
    user_id: row.user_id,
    type: row.type,
    project_id: row.project_id,
    absence_kind: row.absence_kind,
    mode: row.mode,
    half_day_slot: row.half_day_slot,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    note: row.note,
    projectLabel: row.projects?.title ?? null,
  }));

  if (project) {
    entries = entries.filter((e) => e.type === "abwesenheit" || e.project_id === project);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Einsatzplanung"
        actions={
          !context.isWritable ? (
            <Badge variant="destructive" className="px-3 py-1 text-xs">
              Testphase abgelaufen – nur lesend
            </Badge>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Link href={weekLink(prevWeek, dayRange, project)}>
            <Button variant="outline" size="sm">
              ← Vorherige Woche
            </Button>
          </Link>
          <Link href={weekLink(monday, dayRange, project)}>
            <Button variant="outline" size="sm">
              Heute
            </Button>
          </Link>
          <Link href={weekLink(nextWeek, dayRange, project)}>
            <Button variant="outline" size="sm">
              Nächste Woche →
            </Button>
          </Link>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <Link href={weekLink(monday, "work", project)}>
            <Button variant={dayRange === "work" ? "default" : "outline"} size="sm">
              Mo–Fr
            </Button>
          </Link>
          <Link href={weekLink(monday, "full", project)}>
            <Button variant={dayRange === "full" ? "default" : "outline"} size="sm">
              Ganze Woche
            </Button>
          </Link>
        </div>

        {showTeamGrid && projectOptions.length > 0 && (
          <form method="get" className="flex items-center gap-2 text-sm">
            <input type="hidden" name="week" value={monday} />
            <input type="hidden" name="range" value={dayRange} />
            <select
              name="project"
              defaultValue={project ?? ""}
              className="h-10 rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="">Alle Projekte</option>
              {projectOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <Button type="submit" variant="outline" size="sm">
              Filtern
            </Button>
          </form>
        )}
      </div>

      {showTeamGrid ? (
        <WeekGrid
          days={days}
          employees={employees}
          entries={entries}
          projectOptions={projectOptions}
          userOptions={employees}
          canEdit={isAdminOrPL && context.isWritable}
        />
      ) : (
        <MyScheduleList
          days={days}
          entries={entries.filter((e) => e.user_id === context.userId)}
        />
      )}
    </div>
  );
}
