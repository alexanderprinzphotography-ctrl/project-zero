import { redirect } from "next/navigation";
import { PageHeader } from "@/core/ui/page-header";
import { createClient } from "@/core/supabase/server";
import { getUserContext } from "@/core/auth/get-user-context";
import { MemberList, type Member } from "./member-list";
import { InviteForm } from "./invite-form";
import { InvitationList, type Invitation } from "./invitation-list";

export default async function TeamPage() {
  const context = await getUserContext();

  if (!context) redirect("/");
  if (context.role === "mitarbeiter") redirect("/");

  const supabase = await createClient();
  const isAdmin = context.role === "admin";

  const { data: members } = await supabase
    .from("profiles")
    .select("id, full_name, email, role")
    .order("created_at", { ascending: true });

  let invitations: Invitation[] = [];
  if (isAdmin) {
    const { data } = await supabase
      .from("invitations")
      .select("id, role, expires_at, max_uses, used_count, revoked_at")
      .order("created_at", { ascending: false });
    invitations = (data as Invitation[] | null) ?? [];
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Team" description={`Mitglieder von ${context.companyName}.`} />

      <MemberList members={(members as Member[] | null) ?? []} />

      {isAdmin && (
        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold tracking-tight">Einladungen</h2>
          <InviteForm />
          <InvitationList invitations={invitations} />
        </div>
      )}
    </div>
  );
}
