import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/core/supabase/server";
import { getUserContext } from "@/core/auth/get-user-context";
import { contactDisplayName, type ContactType } from "@/core/crm/contact";
import { PROJECT_STATUSES, projectStatusLabel, type ProjectStatus } from "@/core/projects/project";

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
  let query = supabase
    .from("projects")
    .select(
      "id, project_number, title, status, site_city, is_archived, contacts(type, company_name, first_name, last_name), project_members(user_id, profiles(full_name, email))",
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

  const { data } = await query;
  const projects = (data as unknown as ProjectRow[] | null) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projekte</h1>
          <p className="mt-1 text-muted-foreground">Baustellen von {context.companyName}.</p>
        </div>
        {canSeeWriteButtons &&
          (canWrite ? (
            <Link href="/projekte/neu">
              <Button>Neues Projekt</Button>
            </Link>
          ) : (
            <Button disabled title="Testphase abgelaufen – Anlegen ist gesperrt.">
              Neues Projekt
            </Button>
          ))}
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="q" className="text-sm font-medium">
            Suche
          </label>
          <input
            id="q"
            name="q"
            type="text"
            defaultValue={q ?? ""}
            placeholder="Titel, Projektnummer, Ort…"
            className="w-64 rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="status" className="text-sm font-medium">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={status ?? "all"}
            className="rounded-md border border-input bg-transparent px-3 py-2 text-sm"
          >
            <option value="all">Alle</option>
            {PROJECT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {projectStatusLabel(s)}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-1.5 pb-2 text-sm">
          <input type="checkbox" name="archived" value="1" defaultChecked={archived === "1"} />
          Archivierte anzeigen
        </label>
        <Button type="submit" variant="outline">
          Filtern
        </Button>
      </form>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="py-2 font-medium">Nr.</th>
            <th className="py-2 font-medium">Titel</th>
            <th className="py-2 font-medium">Kunde</th>
            <th className="py-2 font-medium">Status</th>
            <th className="py-2 font-medium">Ort</th>
            <th className="py-2 font-medium">Team</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => (
            <tr key={project.id} className="border-b border-border last:border-0 hover:bg-accent/5">
              <td className="py-2">
                <Link href={`/projekte/${project.id}`} className="block">
                  {project.project_number}
                </Link>
              </td>
              <td className="py-2">
                <Link href={`/projekte/${project.id}`} className="block hover:underline">
                  {project.title}
                  {project.is_archived && (
                    <span className="ml-2 text-xs text-muted-foreground">(archiviert)</span>
                  )}
                </Link>
              </td>
              <td className="py-2">{project.contacts ? contactDisplayName(project.contacts) : "–"}</td>
              <td className="py-2">
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                  {projectStatusLabel(project.status)}
                </span>
              </td>
              <td className="py-2">{project.site_city ?? "–"}</td>
              <td className="py-2">
                {project.project_members.length > 0
                  ? project.project_members
                      .map((m) => m.profiles?.full_name ?? m.profiles?.email ?? "–")
                      .join(", ")
                  : "–"}
              </td>
            </tr>
          ))}
          {projects.length === 0 && (
            <tr>
              <td colSpan={6} className="py-6 text-center text-muted-foreground">
                Keine Projekte gefunden.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
