import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/core/supabase/server";
import { getUserContext } from "@/core/auth/get-user-context";
import { contactDisplayName, type ContactType } from "@/core/crm/contact";
import { projectStatusLabel, type Project } from "@/core/projects/project";
import { handwerkProjectFields } from "@/modules/handwerk/project-fields";
import type { DiaryCategory, DiaryEntry } from "@/core/diary/entry";
import { ArchiveToggleButton } from "./archive-toggle-button";
import { StatusChanger } from "./status-changer";
import { AddMemberForm, type AssignableUser } from "./add-member-form";
import { RemoveMemberButton } from "./remove-member-button";
import { DiarySection } from "./diary-section";

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
}

function formatDate(value: string | null): string | null {
  if (!value) return null;
  return new Date(value).toLocaleDateString("de-DE");
}

type ProjectDetailRow = Project & {
  contacts: {
    id: string;
    type: ContactType;
    company_name: string | null;
    first_name: string | null;
    last_name: string | null;
  } | null;
};

type MemberRow = {
  id: string;
  user_id: string;
  assigned_at: string;
  profiles: { full_name: string | null; email: string | null } | null;
};

type DiaryEntryRow = {
  id: string;
  seq: number;
  created_at: string;
  category: DiaryCategory | null;
  text: string | null;
  corrects_entry_id: string | null;
  profiles: { full_name: string | null; email: string | null } | null;
  diary_photos: { id: string; storage_path: string }[];
};

export default async function ProjektDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const context = await getUserContext();
  if (!context) redirect("/login");

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("*, contacts(id, type, company_name, first_name, last_name)")
    .eq("id", id)
    .maybeSingle<ProjectDetailRow>();

  if (!project) notFound();

  const canWrite = ["admin", "projektleiter"].includes(context.role);
  const canEdit = canWrite && context.isWritable;

  // project_members hat zwei Fremdschluessel auf profiles (user_id, assigned_by) -
  // ohne den expliziten Hint kann PostgREST die Einbettung nicht eindeutig aufloesen.
  const { data: membersData } = await supabase
    .from("project_members")
    .select("id, user_id, assigned_at, profiles!project_members_user_id_fkey(full_name, email)")
    .eq("project_id", id)
    .order("assigned_at", { ascending: true });
  const members = (membersData as unknown as MemberRow[] | null) ?? [];

  let availableUsers: AssignableUser[] = [];
  if (canWrite) {
    const { data: allProfiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .order("created_at", { ascending: true });
    const assignedIds = new Set(members.map((m) => m.user_id));
    availableUsers = (allProfiles ?? []).filter((p) => !assignedIds.has(p.id));
  }

  // diary_entries -> profiles hat nur EINEN Fremdschluessel (author_id), also
  // hier keine Mehrdeutigkeit wie bei project_members (siehe dort).
  const { data: diaryRows } = await supabase
    .from("diary_entries")
    .select(
      "id, seq, created_at, category, text, corrects_entry_id, profiles(full_name, email), diary_photos(id, storage_path)",
    )
    .eq("project_id", id)
    .order("seq", { ascending: false });
  const diaryEntryRows = (diaryRows as unknown as DiaryEntryRow[] | null) ?? [];

  const allPhotoPaths = diaryEntryRows.flatMap((r) => r.diary_photos.map((p) => p.storage_path));
  const signedUrlMap = new Map<string, string>();
  if (allPhotoPaths.length > 0) {
    const { data: signedUrls } = await supabase.storage
      .from("diary-photos")
      .createSignedUrls(allPhotoPaths, 3600);
    (signedUrls ?? []).forEach((s, i) => {
      if (s.signedUrl) signedUrlMap.set(allPhotoPaths[i], s.signedUrl);
    });
  }

  const diaryEntries: DiaryEntry[] = diaryEntryRows.map((row) => ({
    id: row.id,
    seq: row.seq,
    created_at: row.created_at,
    category: row.category,
    text: row.text,
    corrects_entry_id: row.corrects_entry_id,
    authorName: row.profiles?.full_name || row.profiles?.email || "Unbekannt",
    photos: row.diary_photos.map((p) => ({
      id: p.id,
      storage_path: p.storage_path,
      signedUrl: signedUrlMap.get(p.storage_path) ?? null,
    })),
  }));

  const canVerifyDiary = ["admin", "projektleiter"].includes(context.role);

  const address = [
    project.site_street,
    [project.site_postal_code, project.site_city].filter(Boolean).join(" "),
    project.site_country,
  ]
    .filter(Boolean)
    .join(", ");

  const period = [formatDate(project.start_date), formatDate(project.planned_end_date)]
    .filter(Boolean)
    .join(" – ");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {project.title}{" "}
            {project.is_archived && (
              <span className="text-sm font-normal text-muted-foreground">(archiviert)</span>
            )}
          </h1>
          <p className="mt-1 text-muted-foreground">
            Projekt #{project.project_number}
            {project.contacts && <> · Kunde: {contactDisplayName(project.contacts)}</>}
          </p>
        </div>
        {canWrite && (
          <div className="flex items-center gap-2">
            {canEdit && (
              <Link href={`/projekte/${project.id}/bearbeiten`}>
                <Button size="sm" variant="outline">
                  Bearbeiten
                </Button>
              </Link>
            )}
            <ArchiveToggleButton id={project.id} isArchived={project.is_archived} />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-full bg-muted px-3 py-1 text-xs">
          {projectStatusLabel(project.status)}
        </span>
        {canEdit && <StatusChanger id={project.id} status={project.status} />}
      </div>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Baustelle</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4">
            <Field label="Adresse" value={address || null} />
            <Field label="Zeitraum" value={period || null} />
          </dl>
          {project.description && (
            <div className="mt-4">
              <dt className="text-xs text-muted-foreground">Beschreibung</dt>
              <dd className="whitespace-pre-wrap text-sm">{project.description}</dd>
            </div>
          )}
          {handwerkProjectFields.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-4">
              {handwerkProjectFields.map((field) => {
                const value = project.metadata?.[field.key];
                if (typeof value !== "string" || !value) return null;
                return <Field key={field.key} label={field.label} value={value} />;
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Team</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch niemand zugewiesen.</p>
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {members.map((m) => (
                <li key={m.id} className="flex items-center justify-between">
                  <span>{m.profiles?.full_name ?? m.profiles?.email ?? m.user_id}</span>
                  {canEdit && <RemoveMemberButton memberId={m.id} projectId={project.id} />}
                </li>
              ))}
            </ul>
          )}
          {canEdit && <AddMemberForm projectId={project.id} availableUsers={availableUsers} />}
        </CardContent>
      </Card>

      <Card className="max-w-3xl">
        <CardContent>
          <DiarySection
            projectId={project.id}
            entries={diaryEntries}
            canWrite
            isWritable={context.isWritable}
            canVerify={canVerifyDiary}
          />
        </CardContent>
      </Card>

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle>Zeiterfassung &amp; Angebote</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Kommt in späteren Meilensteinen.
        </CardContent>
      </Card>
    </div>
  );
}
