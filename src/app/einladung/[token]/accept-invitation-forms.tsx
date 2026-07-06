"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { acceptAsExistingAccount, acceptAsNewAccount, type InviteActionState } from "./actions";

const initialState: InviteActionState = { error: null, info: null };

const fieldClass =
  "rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

export function AcceptInvitationForms({ token }: { token: string }) {
  const boundNew = acceptAsNewAccount.bind(null, token);
  const boundExisting = acceptAsExistingAccount.bind(null, token);

  const [newState, newAction, newPending] = useActionState(boundNew, initialState);
  const [existingState, existingAction, existingPending] = useActionState(
    boundExisting,
    initialState,
  );

  return (
    <div className="flex flex-col gap-6">
      <form action={newAction} className="flex flex-col gap-3">
        <h3 className="text-sm font-medium">Neues Konto erstellen</h3>
        <input name="fullName" type="text" placeholder="Name" required className={fieldClass} />
        <input
          name="email"
          type="email"
          placeholder="E-Mail"
          required
          autoComplete="email"
          className={fieldClass}
        />
        <input
          name="password"
          type="password"
          placeholder="Passwort"
          required
          minLength={8}
          autoComplete="new-password"
          className={fieldClass}
        />
        {newState.error && <p className="text-sm text-destructive">{newState.error}</p>}
        {newState.info && <p className="text-sm text-muted-foreground">{newState.info}</p>}
        <Button type="submit" disabled={newPending}>
          {newPending ? "Wird erstellt…" : "Konto erstellen & beitreten"}
        </Button>
      </form>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <div className="h-px flex-1 bg-border" />
        oder
        <div className="h-px flex-1 bg-border" />
      </div>

      <form action={existingAction} className="flex flex-col gap-3">
        <h3 className="text-sm font-medium">Ich habe bereits ein Konto</h3>
        <input
          name="email"
          type="email"
          placeholder="E-Mail"
          required
          autoComplete="email"
          className={fieldClass}
        />
        <input
          name="password"
          type="password"
          placeholder="Passwort"
          required
          autoComplete="current-password"
          className={fieldClass}
        />
        {existingState.error && <p className="text-sm text-destructive">{existingState.error}</p>}
        {existingState.info && (
          <p className="text-sm text-muted-foreground">{existingState.info}</p>
        )}
        <Button type="submit" variant="outline" disabled={existingPending}>
          {existingPending ? "Wird angemeldet…" : "Anmelden & beitreten"}
        </Button>
      </form>
    </div>
  );
}
