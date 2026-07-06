"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
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
    <table className="w-full max-w-3xl text-sm">
      <thead>
        <tr className="border-b border-border text-left text-muted-foreground">
          <th className="py-2 font-medium">Rolle</th>
          <th className="py-2 font-medium">Typ</th>
          <th className="py-2 font-medium">Ablauf</th>
          <th className="py-2 font-medium">Nutzung</th>
          <th className="py-2 font-medium">Status</th>
          <th className="py-2 font-medium" />
        </tr>
      </thead>
      <tbody>
        {invitations.map((inv) => {
          const status = invitationStatus(inv);
          return (
            <tr key={inv.id} className="border-b border-border last:border-0">
              <td className="py-2">{roleLabel(inv.role)}</td>
              <td className="py-2">{inv.max_uses === null ? "Team-Link" : "Einmal-Link"}</td>
              <td className="py-2">{new Date(inv.expires_at).toLocaleDateString("de-DE")}</td>
              <td className="py-2">
                {inv.used_count}
                {inv.max_uses !== null ? ` / ${inv.max_uses}` : ""}
              </td>
              <td className="py-2">{status}</td>
              <td className="py-2 text-right">{status === "Aktiv" && <RevokeButton id={inv.id} />}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
