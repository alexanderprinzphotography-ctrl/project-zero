"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/core/ui/field";
import { FormMessage } from "@/core/ui/form-message";
import { centsToEuroInputValue } from "@/core/money/cents";
import { updateAutoReleaseSettings, type ThemeActionState } from "./actions";

const initialState: ThemeActionState = { error: null, success: false };

export function AutoReleaseForm({
  initialEnabled,
  initialLimitCents,
  readOnly,
}: {
  initialEnabled: boolean;
  initialLimitCents: number;
  readOnly: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateAutoReleaseSettings, initialState);
  const [enabled, setEnabled] = useState(initialEnabled);
  const [limitEuro, setLimitEuro] = useState(centsToEuroInputValue(initialLimitCents));

  return (
    <form action={formAction} onReset={(e) => e.preventDefault()} className="flex flex-col gap-3">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          disabled={readOnly}
        />
        Angebote unter einem Betrags-Limit automatisch freigeben
      </label>
      <input type="hidden" name="autoReleaseEnabled" value={enabled ? "true" : "false"} />
      <Field label="Limit (Brutto, €)" htmlFor="autoReleaseLimitEuro" className="w-40">
        <Input
          id="autoReleaseLimitEuro"
          name="autoReleaseLimitEuro"
          value={limitEuro}
          onChange={(e) => setLimitEuro(e.target.value)}
          disabled={readOnly || !enabled}
          placeholder="500,00"
        />
      </Field>
      <FormMessage error={state.error} success={state.success ? "Gespeichert." : null} />
      <Button type="submit" disabled={readOnly || pending} className="w-fit">
        {pending ? "Wird gespeichert…" : "Auto-Freigabe speichern"}
      </Button>
    </form>
  );
}
