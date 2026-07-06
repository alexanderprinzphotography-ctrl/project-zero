import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/core/supabase/server";
import { getUserContext } from "@/core/auth/get-user-context";
import { AcceptInvitationForms } from "./accept-invitation-forms";
import { JoinDirectlyForm } from "./join-directly-form";

type InvitationPreview = { company_name: string; role: string; valid: boolean };

function roleLabel(role: string): string {
  switch (role) {
    case "admin":
      return "Admin";
    case "projektleiter":
      return "Projektleiter";
    default:
      return "Mitarbeiter";
  }
}

export default async function EinladungPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();

  const { data: preview } = await supabase
    .rpc("get_invitation_preview", { token })
    .maybeSingle<InvitationPreview>();

  if (!preview || !preview.valid) {
    return (
      <div className="flex justify-center">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Einladung ungültig</CardTitle>
            <CardDescription>
              Dieser Link ist ungültig, abgelaufen, widerrufen oder wurde bereits vollständig
              genutzt.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  const userContext = await getUserContext();

  if (userContext) {
    return (
      <div className="flex justify-center">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Bereits einer Firma zugehörig</CardTitle>
            <CardDescription>
              Dieser Account gehört bereits zu {userContext.companyName}. Im MVP kann ein Konto
              nur einer Firma angehören.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex justify-center">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Einladung zu {preview.company_name}</CardTitle>
          <CardDescription>Rolle: {roleLabel(preview.role)}</CardDescription>
        </CardHeader>
        <CardContent>
          {authUser ? <JoinDirectlyForm token={token} /> : <AcceptInvitationForms token={token} />}
        </CardContent>
      </Card>
    </div>
  );
}
