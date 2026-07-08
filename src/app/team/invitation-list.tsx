"use client";

import { useActionState } from "react";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ListContainer, ListRow } from "@/core/ui/list";
import { revokeInvitation, type InvitationActionState } from "./actions";

export type Invitation = {
  id: string;
  role: string;
  expires_at: string;
  max_uses: number | null;
  used_count: number;
  revoked_at: string | null;
};

const initialState: InvitationActionState = { error: null, link: null };

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

function invitationStatus(inv: Invitation): "Aktiv" | "Widerrufen" | "Abgelaufen" | "Aufgebraucht" {
  if (inv.revoked_at) return "Widerrufen";
  if (new Date(inv.expires_at) <= new Date()) return "Abgelaufen";
  if (inv.max_uses !== null && inv.used_count >= inv.max_uses) return "Aufgebraucht";
  return "Aktiv";
}

function invitationStatusVariant(
  status: "Aktiv" | "Widerrufen" | "Abgelaufen" | "Aufgebraucht",
): BadgeVariant {
  switch (status) {
    case "Aktiv":
      return "success";
    case "Widerrufen":
      return "destructive";
    case "Abgelaufen":
      return "default";
    case "Aufgebraucht":
      return "warning";
  }
}

function RevokeButton({ id }: { id: string }) {
  const [state, formAction, pending] = useActionState(revokeInvitation, initialState);

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        {pending ? "…" : "Widerrufen"}
      </Button>
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
    </form>
  );
}

export function InvitationList({ invitations }: { invitations: Invitation[] }) {
  if (invitations.length === 0) {
    return <p className="text-sm text-muted-foreground">Noch keine Einladungen erstellt.</p>;
  }

  return (
    <ListContainer className="max-w-3xl">
      {invitations.map((inv) => {
        const status = invitationStatus(inv);
        return (
          <ListRow key={inv.id}>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="font-medium">
                {roleLabel(inv.role)} · {inv.max_uses === null ? "Team-Link" : "Einmal-Link"}
              </span>
              <span className="text-xs text-muted-foreground">
                Ablauf: {new Date(inv.expires_at).toLocaleDateString("de-DE")} · Nutzung: {inv.used_count}
                {inv.max_uses !== null ? ` / ${inv.max_uses}` : ""}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={invitationStatusVariant(status)}>{status}</Badge>
              {status === "Aktiv" && <RevokeButton id={inv.id} />}
            </div>
          </ListRow>
        );
      })}
    </ListContainer>
  );
}
