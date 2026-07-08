import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/core/ui/empty-state";
import { FilterBar, FilterField } from "@/core/ui/filter-bar";
import { ListContainer, ListRow } from "@/core/ui/list";
import { PageHeader } from "@/core/ui/page-header";
import { createClient } from "@/core/supabase/server";
import { getUserContext } from "@/core/auth/get-user-context";
import { contactDisplayName, type ContactType } from "@/core/crm/contact";
import { PROJECT_STATUSES, projectStatusLabel, projectStatusVariant, type ProjectStatus } from "@/core/projects/project";

function escapeOrFilterValue(value: string): string {
  return value.replace(/[,%]/g, "");
}

type ProjectRow = {
  id: string;
  project_number: number;
  title: string;
  status: ProjectStatus;
  site_city: string | null;
  is_archived: boolean;
  contacts: {
    type: ContactType;
    company_name: string | null;
    first_name: string | null;
    last_name: string | null;
  } | null;
  project_members: { user_id: string; profiles: { full_name: string | null; email: string | null } | null }[];
};

export default async function ProjektePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; archived?: string }>;
}) {
  const { q, status, archived } = await searchParams;
  const context = await getUserContext();
  if (!context) redirect("/login");

  const canWrite = ["admin", "projektleiter"].includes(context.role) && context.isWritable;
  const canSeeWriteButtons = ["admin", "projektleiter"].includes(context.role);

  const supabase = await createClient();
  // project_members hat zwei Fremdschluessel auf profiles (user_id, assigned_by) -
  // ohne den expliziten Hint kann PostgREST die Einbettung nicht eindeutig aufloesen
  // (Fehler PGRST201, Query liefert dann komplett null statt einer Teilmenge).
  let query = supabase
    .from("projects")
    .select(
      "id, project_number, title, status, site_city, is_archived, contacts(type, company_name, first_name, last_name), project_members(user_id, profiles!project_members_user_id_fkey(full_name, email))",
    )
    .order("project_number", { ascending: true });

  if (archived !== "1") {
    query = query.eq("is_archived", false);
  }
  if (status && (PROJECT_STATUSES as string[]).includes(status)) {
    query = query.eq("status", status);
  }

  const term = escapeOrFilterValue((q ?? "").trim());
  if (term) {
    const orParts = [`title.ilike.%${term}%`, `site_city.ilike.%${term}%`];
    if (/^\d+$/.test(term)) {
      orParts.push(`project_number.eq.${term}`);
    }
    query = query.or(orParts.join(","));
  }

  const { data, error } = await query;
  if (error) {
    console.error("Fehler beim Laden der Projektliste:", error);
  }
  const projects = (data as unknown as ProjectRow[] | null) ?? [];
  const hasFilters = Boolean(q || status || archived === "1");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Projekte"
        description={`Baustellen von ${context.companyName}.`}
        actions={
          canSeeWriteButtons ? (
            canWrite ? (
              <Link href="/projekte/neu">
                <Button>Neues Projekt</Button>
              </Link>
            ) : (
              <Button disabled title="Testphase abgelaufen – Anlegen ist gesperrt.">
                Neues Projekt
              </Button>
            )
          ) : undefined
        }
      />

      <FilterBar method="get">
        <FilterField label="Suche" htmlFor="q">
          <Input
            id="q"
            name="q"
            type="text"
            defaultValue={q ?? ""}
            placeholder="Titel, Projektnummer, Ort…"
            className="w-64"
          />
        </FilterField>
        <FilterField label="Status" htmlFor="status">
          <select
            id="status"
            name="status"
            defaultValue={status ?? "all"}
            className="h-10 rounded-md border border-input bg-transparent px-3 text-sm"
          >
            <option value="all">Alle</option>
            {PROJECT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {projectStatusLabel(s)}
              </option>
            ))}
          </select>
        </FilterField>
        <label className="flex items-center gap-1.5 pb-2.5 text-sm">
          <input type="checkbox" name="archived" value="1" defaultChecked={archived === "1"} />
          Archivierte anzeigen
        </label>
        <Button type="submit" variant="outline">
          Filtern
        </Button>
      </FilterBar>

      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Projekte konnten nicht geladen werden. Bitte versuche es erneut.
        </p>
      )}

      {projects.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={hasFilters ? "Keine Projekte für diese Filter." : "Noch keine Projekte."}
          action={
            canWrite && !hasFilters ? (
              <Link href="/projekte/neu">
                <Button size="sm">Erstes Projekt anlegen</Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <ListContainer>
          {projects.map((project) => (
            <ListRow key={project.id} href={`/projekte/${project.id}`}>
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="font-medium">
                  #{project.project_number} · {project.title}
                  {project.is_archived && (
                    <span className="ml-2 text-xs text-muted-foreground">(archiviert)</span>
                  )}
                </span>
                <span className="text-xs text-muted-foreground">
                  {project.contacts ? contactDisplayName(project.contacts) : "Kein Kunde"}
                  {project.site_city && ` · ${project.site_city}`}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">
                  {project.project_members.length > 0
                    ? project.project_members
                        .map((m) => m.profiles?.full_name ?? m.profiles?.email ?? "–")
                        .join(", ")
                    : "Kein Team zugewiesen"}
                </span>
                <Badge variant={projectStatusVariant(project.status)}>
                  {projectStatusLabel(project.status)}
                </Badge>
              </div>
            </ListRow>
          ))}
        </ListContainer>
      )}
    </div>
  );
}
