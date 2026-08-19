"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/core/ui/field";
import { FormMessage } from "@/core/ui/form-message";
import { updateContactSettings, type ThemeActionState } from "./actions";

const INITIAL_STATE: ThemeActionState = { error: null, success: false };

export function ContactSettingsForm({
  initialReplyToEmail,
  initialContactPhone,
  readOnly,
}: {
  initialReplyToEmail: string | null;
  initialContactPhone: string | null;
  readOnly: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateContactSettings, INITIAL_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <Field
        label="Antwort-E-Mail"
        htmlFor="replyToEmail"
        hint="Kundenantworten auf Angebots-Mails gehen an diese Adresse. Ohne Angabe wird deine eigene E-Mail verwendet."
      >
        <Input
          id="replyToEmail"
          name="replyToEmail"
          type="email"
          defaultValue={initialReplyToEmail ?? ""}
          placeholder="info@deine-firma.de"
          disabled={readOnly}
        />
      </Field>
      <Field label="Telefon (für die Mail-Signatur)" htmlFor="contactPhone">
        <Input
          id="contactPhone"
          name="contactPhone"
          defaultValue={initialContactPhone ?? ""}
          placeholder="+49 30 12345678"
          disabled={readOnly}
        />
      </Field>
      <FormMessage error={state.error} success={state.success ? "Gespeichert." : null} />
      <Button type="submit" disabled={readOnly || pending} className="w-fit">
        {pending ? "Wird gespeichert…" : "Kontaktdaten speichern"}
      </Button>
    </form>
  );
}
