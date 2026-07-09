import Link from "next/link";
import { Building2, CalendarClock, CalendarDays, Clock, FileText, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/core/ui/empty-state";
import { KpiTile } from "@/core/ui/kpi-tile";
import { ListContainer, ListRow } from "@/core/ui/list";
import { createClient } from "@/core/supabase/server";
import { contactDisplayName, type ContactType } from "@/core/crm/contact";
import { formatCentsAsEuro } from "@/core/money/cents";
import { addDays, getMondayOfWeek, todayDateKey } from "@/core/schedule/entry";
import { formatDurationHM, netSeconds } from "@/core/time/entry";
import { quoteStatusLabel, quoteStatusVariant, type QuoteStatus } from "@/core/quotes/quote";

type QuoteRow = {
  id: string;
  quote_number: number;
  status: QuoteStatus;
  gross_total_cents: number;
  contacts: {
    type: ContactType;
    company_name: string | null;
    first_name: string | null;
    last_name: string | null;
  } | null;
};

type ScheduleRow = { id: string; user_id: string; type: "einsatz" | "abwesenheit"; projects: { title: string } | null };

function isoOf(dateKey: string): string {
  return new Date(`${dateKey}T00:00:00`).toISOString();
}

/** Firmen-Uebersicht fuer admin/projektleiter - alle Abfragen laufen unter der normalen Nutzer-Session, RLS filtert automatisch (siehe MS 10c Plan). Keine neue Geld-/Datumslogik, nur Wiederverwendung bestehender Helfer. */
export async function AdminOverview({ isWritable }: { isWritable: boolean }) {
  const supabase = await createClient();

  const today = todayDateKey();
  const tomorrow = addDays(today, 1);
  const monday = getMondayOfWeek(today);
  const nextMonday = addDays(monday, 7);

  const [
    { count: activeProjectsCount },
    { data: openQuotesData },
    { count: weekScheduleCount },
    { data: weekTimeEntriesData },
    { data: todayScheduleData },
    { data: recentQuotesData },
    { data: profilesData },
  ] = await Promise.all([
    supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("status", "aktiv")
      .eq("is_archived", false),
    supabase
      .from("quotes")
      .select("id, quote_number, status, gross_total_cents, contacts(type, company_name, first_name, last_name)")
      .in("status", ["entwurf", "zur_freigabe"])
      .order("quote_number", { ascending: true }),
    supabase
      .from("schedule_entries")
      .select("id", { count: "exact", head: true })
      .gte("starts_at", isoOf(monday))
      .lt("starts_at", isoOf(nextMonday)),
    supabase
      .from("time_entries")
      .select("started_at, ended_at, break_minutes")
      .not("ended_at", "is", null)
      .gte("started_at", isoOf(monday))
      .lt("started_at", isoOf(nextMonday)),
    supabase
      .from("schedule_entries")
      .select("id, user_id, type, projects(title)")
      .gte("starts_at", isoOf(today))
      .lt("starts_at", isoOf(tomorrow)),
    supabase
      .from("quotes")
      .select("id, quote_number, status, gross_total_cents, contacts(type, company_name, first_name, last_name)")
      .order("updated_at", { ascending: false })
      .limit(5),
    supabase.from("profiles").select("id, full_name, email"),
  ]);

  const openQuotes = (openQuotesData as unknown as QuoteRow[] | null) ?? [];
  const openQuotesTotalCents = openQuotes.reduce((sum, q) => sum + q.gross_total_cents, 0);

  const weekSeconds = (
    (weekTimeEntriesData as { started_at: string; ended_at: string; break_minutes: number }[] | null) ?? []
  ).reduce((sum, e) => sum + netSeconds(e.started_at, e.ended_at, e.break_minutes), 0);

  const todaySchedule = (todayScheduleData as unknown as ScheduleRow[] | null) ?? [];
  const profileNames = new Map(
    ((profilesData as { id: string; full_name: string | null; email: string | null }[] | null) ?? []).map((p) => [
      p.id,
      p.full_name || p.email || "Unbekannt",
    ]),
  );

  const recentQuotes = (recentQuotesData as unknown as QuoteRow[] | null) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile icon={Building2} label="Aktive Baustellen" value={String(activeProjectsCount ?? 0)} />
        <KpiTile
          icon={FileText}
          label="Offene Angebote"
          value={String(openQuotes.length)}
          hint={formatCentsAsEuro(openQuotesTotalCents)}
        />
        <KpiTile icon={CalendarDays} label="Einsätze diese Woche" value={String(weekScheduleCount ?? 0)} />
        <KpiTile icon={Clock} label="Erfasste Zeit diese Woche" value={formatDurationHM(weekSeconds)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Schnellaktionen</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {[
            { href: "/projekte/neu", label: "Neues Projekt" },
            { href: "/kunden/neu", label: "Neuer Kunde" },
            { href: "/angebote/neu", label: "Neues Angebot" },
          ].map((action) =>
            isWritable ? (
              <Link key={action.href} href={action.href}>
                <Button size="sm">
                  <Plus className="size-4" /> {action.label}
                </Button>
              </Link>
            ) : (
              <Button key={action.href} size="sm" disabled title="Testphase abgelaufen – Anlegen ist gesperrt.">
                <Plus className="size-4" /> {action.label}
              </Button>
            ),
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Braucht Aufmerksamkeit</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Offene Angebote</p>
              {openQuotes.length === 0 ? (
                <EmptyState icon={FileText} title="Keine offenen Angebote." />
              ) : (
                <ListContainer>
                  {openQuotes.slice(0, 5).map((q) => (
                    <ListRow key={q.id} href={`/angebote/${q.id}`}>
                      <span>
                        #{q.quote_number} · {q.contacts ? contactDisplayName(q.contacts) : "–"}
                      </span>
                      <span className="flex items-center gap-2">
                        <Badge variant={quoteStatusVariant(q.status)}>{quoteStatusLabel(q.status)}</Badge>
                        <span className="font-medium">{formatCentsAsEuro(q.gross_total_cents)}</span>
                      </span>
                    </ListRow>
                  ))}
                </ListContainer>
              )}
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Heutige Einsätze</p>
              {todaySchedule.length === 0 ? (
                <EmptyState icon={CalendarClock} title="Keine Einsätze für heute geplant." />
              ) : (
                <ListContainer>
                  {todaySchedule.map((entry) => (
                    <ListRow key={entry.id}>
                      <span>{profileNames.get(entry.user_id) ?? "Unbekannt"}</span>
                      <span className="text-muted-foreground">
                        {entry.type === "abwesenheit" ? "Abwesend" : (entry.projects?.title ?? "–")}
                      </span>
                    </ListRow>
                  ))}
                </ListContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Letzte Aktivität</CardTitle>
          </CardHeader>
          <CardContent>
            {recentQuotes.length === 0 ? (
              <EmptyState icon={FileText} title="Noch keine Angebote." />
            ) : (
              <ListContainer>
                {recentQuotes.map((q) => (
                  <ListRow key={q.id} href={`/angebote/${q.id}`}>
                    <span>
                      #{q.quote_number} · {q.contacts ? contactDisplayName(q.contacts) : "–"}
                    </span>
                    <Badge variant={quoteStatusVariant(q.status)}>{quoteStatusLabel(q.status)}</Badge>
                  </ListRow>
                ))}
              </ListContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
