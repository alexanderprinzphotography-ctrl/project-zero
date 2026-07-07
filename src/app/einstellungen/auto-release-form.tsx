"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
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
      <div className="flex flex-col gap-1.5 text-sm">
        <label htmlFor="autoReleaseLimitEuro" className="font-medium">
          Limit (Brutto, €)
        </label>
        <input
          id="autoReleaseLimitEuro"
          name="autoReleaseLimitEuro"
          value={limitEuro}
          onChange={(e) => setLimitEuro(e.target.value)}
          disabled={readOnly || !enabled}
          placeholder="500,00"
          className="w-40 rounded-md border border-input bg-transparent px-3 py-2 text-sm"
        />
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && <p className="text-sm text-muted-foreground">Gespeichert.</p>}
      <Button type="submit" disabled={readOnly || pending} className="w-fit">
        {pending ? "Wird gespeichert…" : "Auto-Freigabe speichern"}
      </Button>
    </form>
  );
}
