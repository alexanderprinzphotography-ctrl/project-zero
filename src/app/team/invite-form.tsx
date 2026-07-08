"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/core/ui/field";
import { FormMessage } from "@/core/ui/form-message";
import { createInvitation, type InvitationActionState } from "./actions";

const initialState: InvitationActionState = { error: null, link: null };

export function InviteForm() {
  const [state, formAction, pending] = useActionState(createInvitation, initialState);
  const [copied, setCopied] = useState(false);

  return (
    <form
      action={(formData) => {
        setCopied(false);
        return formAction(formData);
      }}
      className="flex flex-col gap-3 rounded-md border border-border p-4"
    >
      <div className="flex flex-wrap gap-3">
        <Field label="Rolle" htmlFor="invite-role">
          <select
            id="invite-role"
            name="role"
            defaultValue="mitarbeiter"
            className="h-10 rounded-md border border-input bg-transparent px-3 text-sm"
          >
            <option value="admin">Admin</option>
            <option value="projektleiter">Projektleiter</option>
            <option value="mitarbeiter">Mitarbeiter</option>
          </select>
        </Field>
        <Field label="Typ" htmlFor="invite-type">
          <select
            id="invite-type"
            name="type"
            defaultValue="single"
            className="h-10 rounded-md border border-input bg-transparent px-3 text-sm"
          >
            <option value="single">Einmal-Link</option>
            <option value="team">Team-Link (mehrfach nutzbar)</option>
          </select>
        </Field>
        <Field label="Ablauf (Tage)" htmlFor="invite-expiresInDays" className="w-24">
          <Input id="invite-expiresInDays" name="expiresInDays" type="number" min={1} max={90} defaultValue={7} />
        </Field>
      </div>
      <FormMessage error={state.error} />
      {state.link && (
        <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm">
          <code className="flex-1 truncate">{state.link}</code>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              navigator.clipboard.writeText(state.link!);
              setCopied(true);
            }}
          >
            {copied ? "Kopiert!" : "Kopieren"}
          </Button>
        </div>
      )}
      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Wird erstellt…" : "Einladung erstellen"}
      </Button>
    </form>
  );
}
