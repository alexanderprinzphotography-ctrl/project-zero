import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/core/ui/page-header";
import { createClient } from "@/core/supabase/server";
import { getUserContext } from "@/core/auth/get-user-context";
import type { TimeEntrySource } from "@/core/time/entry";
import { PersonalTimerWidget } from "./personal-timer-widget";
import { TimeEntryList } from "./time-entry-list";
import type { DisplayTimeEntry } from "./time-entry-row";

type MyTimeEntryRow = {
  id: string;
  project_id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  break_minutes: number;
  note: string | null;
  entry_source: TimeEntrySource;
  projects: { title: string } | null;
};

export default async function ZeitenPage() {
  const context = await getUserContext();
  if (!context) redirect("/login");

  const supabase = await createClient();

  const { data: projects } = await supabase
    .from("projects")
    .select("id, title")
    .eq("is_archived", false)
    .order("title", { ascending: true });
  const projectOptions = (projects ?? []).map((p) => ({ id: p.id, label: p.title }));

  const { data: runningTimerRow } = await supabase
    .from("time_entries")
    .select("id, started_at, project_id, projects(title)")
    .eq("user_id", context.userId)
    .is("ended_at", null)
    .maybeSingle<{ id: string; started_at: string; project_id: string; projects: { title: string } | null }>();

  const { data: myEntriesRaw } = await supabase
    .from("time_entries")
    .select(
      "id, project_id, user_id, started_at, ended_at, break_minutes, note, entry_source, projects(title)",
    )
    .eq("user_id", context.userId)
    .order("started_at", { ascending: false })
    .limit(100);

  const myEntries: DisplayTimeEntry[] = ((myEntriesRaw as unknown as MyTimeEntryRow[] | null) ?? []).map(
    (row) => ({
      id: row.id,
      project_id: row.project_id,
      user_id: row.user_id,
      started_at: row.started_at,
      ended_at: row.ended_at,
      break_minutes: row.break_minutes,
      note: row.note,
      entry_source: row.entry_source,
      projectLabel: row.projects?.title ?? "Unbekannt",
    }),
  );

  const canSeeAuswertung = ["admin", "projektleiter"].includes(context.role);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Meine Zeiten"
        actions={
          canSeeAuswertung ? (
            <Link href="/zeiten/auswertung">
              <Button variant="outline" size="sm">
                Auswertung
              </Button>
            </Link>
          ) : undefined
        }
      />

      {context.isWritable ? (
        <PersonalTimerWidget
          projectOptions={projectOptions}
          runningEntry={
            runningTimerRow
              ? {
                  id: runningTimerRow.id,
                  started_at: runningTimerRow.started_at,
                  projectLabel: runningTimerRow.projects?.title ?? "Unbekannt",
                }
              : null
          }
        />
      ) : (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Testphase abgelaufen – Zeiterfassung ist gesperrt.
        </p>
      )}

      <TimeEntryList
        entries={myEntries}
        projectOptions={projectOptions}
        userOptions={[]}
        currentUserId={context.userId}
        isAdminOrPL={false}
        isWritable={context.isWritable}
        showProject
      />
    </div>
  );
}
