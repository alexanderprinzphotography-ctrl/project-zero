"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/core/ui/field";
import { FormMessage } from "@/core/ui/form-message";
import { sendQuoteEmail, type SendEmailActionState } from "./email-actions";

const INITIAL_STATE: SendEmailActionState = { error: null, success: false };

export function SendEmailDialog({
  quoteId,
  quoteNumber,
  companyName,
  defaultRecipientEmail,
}: {
  quoteId: string;
  quoteNumber: number;
  companyName: string;
  defaultRecipientEmail: string;
}) {
  const [open, setOpen] = useState(false);
  const action = sendQuoteEmail.bind(null, quoteId);
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);

  // Dialog nach erfolgreichem Versand schliessen - bewusst waehrend des
  // Renderns angepasst statt in einem Effect (React-Empfehlung: "Adjusting
  // state when a prop/value changes" statt setState synchron in useEffect).
  const [handledSuccess, setHandledSuccess] = useState(false);
  if (state.success && !handledSuccess) {
    setHandledSuccess(true);
    setOpen(false);
  } else if (!state.success && handledSuccess) {
    setHandledSuccess(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        Angebot per E-Mail senden
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Angebot per E-Mail senden</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-3">
          <Field label="Empfänger" htmlFor="recipientEmail">
            <Input
              id="recipientEmail"
              name="recipientEmail"
              type="email"
              defaultValue={defaultRecipientEmail}
              required
            />
          </Field>
          <Field label="Betreff" htmlFor="subject">
            <Input
              id="subject"
              name="subject"
              defaultValue={`Ihr Angebot #${quoteNumber} von ${companyName}`}
              required
            />
          </Field>
          <Field label="Persönliche Nachricht (optional)" htmlFor="personalMessage">
            <Textarea id="personalMessage" name="personalMessage" rows={3} />
          </Field>
          <FormMessage error={state.error} success={null} />
          <Button type="submit" disabled={pending} className="w-fit">
            {pending ? "Wird gesendet…" : "Senden"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
