"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/core/ui/field";
import { FormMessage } from "@/core/ui/form-message";
import { respondToQuoteShare, type QuoteResponseActionState } from "./actions";

const INITIAL_STATE: QuoteResponseActionState = { error: null, success: false };

export function QuoteResponseForm({ token }: { token: string }) {
  const [name, setName] = useState("");
  const acceptAction = respondToQuoteShare.bind(null, token, "angenommen");
  const rejectAction = respondToQuoteShare.bind(null, token, "abgelehnt");

  const [acceptState, submitAccept, acceptPending] = useActionState(acceptAction, INITIAL_STATE);
  const [rejectState, submitReject, rejectPending] = useActionState(rejectAction, INITIAL_STATE);

  const pending = acceptPending || rejectPending;
  const error = acceptState.error || rejectState.error;

  return (
    <form action={submitAccept} className="flex flex-col gap-3">
      <Field label="Dein Name" htmlFor="responderName" hint="Zur Bestätigung deiner Antwort.">
        <Input
          id="responderName"
          name="responderName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Vor- und Nachname"
          disabled={pending}
        />
      </Field>
      <FormMessage error={error} success={null} />
      <div className="flex gap-2">
        <Button type="submit" disabled={pending || !name.trim()}>
          {acceptPending ? "…" : "Angebot annehmen"}
        </Button>
        <Button
          type="submit"
          formAction={submitReject}
          variant="outline"
          disabled={pending || !name.trim()}
        >
          {rejectPending ? "…" : "Angebot ablehnen"}
        </Button>
      </div>
    </form>
  );
}
