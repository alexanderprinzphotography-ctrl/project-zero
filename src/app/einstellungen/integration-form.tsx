"use client";

import { useActionState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/core/ui/field";
import { FormMessage } from "@/core/ui/form-message";
import {
  disconnectIntegration,
  retestIntegration,
  saveAndTestIntegration,
  type IntegrationActionState,
} from "./integration-actions";

const INITIAL_STATE: IntegrationActionState = { error: null, success: null };

export function IntegrationForm({
  connected,
  status,
  lastError,
  keyLast4,
  connectedAt,
  readOnly,
}: {
  connected: boolean;
  status: "ok" | "error" | null;
  lastError: string | null;
  keyLast4: string | null;
  connectedAt: string | null;
  readOnly: boolean;
}) {
  const [saveState, saveAction, savePending] = useActionState(saveAndTestIntegration, INITIAL_STATE);
  const [retestState, retestAction, retestPending] = useActionState(retestIntegration, INITIAL_STATE);
  const [disconnectState, disconnectAction, disconnectPending] = useActionState(
    disconnectIntegration,
    INITIAL_STATE,
  );

  if (!connected) {
    return (
      <form action={saveAction} className="flex flex-col gap-3">
        <Field
          label="sevdesk-API-Schlüssel"
          htmlFor="apiKey"
          hint="In sevdesk unter Einstellungen → Benutzer → Nutzer auswählen → API-Token."
        >
          <Input id="apiKey" name="apiKey" type="password" autoComplete="off" disabled={readOnly} />
        </Field>
        <FormMessage error={saveState.error} success={saveState.success} />
        <Button type="submit" disabled={readOnly || savePending} className="w-fit">
          {savePending ? "Wird geprüft…" : "Verbindung testen & speichern"}
        </Button>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={status === "ok" ? "success" : "destructive"}>
          {status === "ok" ? "Verbunden" : "Fehler"}
        </Badge>
        {keyLast4 && <span className="text-sm text-muted-foreground">••••{keyLast4}</span>}
        {connectedAt && (
          <span className="text-sm text-muted-foreground">
            seit {new Date(connectedAt).toLocaleDateString("de-DE")}
          </span>
        )}
      </div>
      {status === "error" && lastError && (
        <p className="text-sm text-destructive">{lastError}</p>
      )}
      <FormMessage error={retestState.error ?? disconnectState.error} success={retestState.success ?? disconnectState.success} />
      <div className="flex gap-2">
        <form action={retestAction}>
          <Button type="submit" variant="outline" size="sm" disabled={retestPending}>
            {retestPending ? "Wird geprüft…" : "Erneut testen"}
          </Button>
        </form>
        <form action={disconnectAction}>
          <Button type="submit" variant="destructive" size="sm" disabled={readOnly || disconnectPending}>
            {disconnectPending ? "Wird getrennt…" : "Verbindung trennen"}
          </Button>
        </form>
      </div>
    </div>
  );
}
