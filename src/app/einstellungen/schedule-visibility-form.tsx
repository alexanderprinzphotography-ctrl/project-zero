"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { updateScheduleVisibility, type ThemeActionState } from "./actions";

const initialState: ThemeActionState = { error: null, success: false };

export function ScheduleVisibilityForm({
  initialValue,
  readOnly,
}: {
  initialValue: string;
  readOnly: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateScheduleVisibility, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="scheduleVisibility"
            value="team"
            defaultChecked={initialValue !== "own"}
            disabled={readOnly}
          />
          Mitarbeiter sehen den ganzen Team-Plan
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="scheduleVisibility"
            value="own"
            defaultChecked={initialValue === "own"}
            disabled={readOnly}
          />
          Mitarbeiter sehen nur ihre eigenen Einsätze (Admin/Projektleiter sehen immer alle)
        </label>
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.success && <p className="text-sm text-muted-foreground">Gespeichert.</p>}
      <Button type="submit" disabled={readOnly || pending} className="w-fit">
        {pending ? "Wird gespeichert…" : "Sichtbarkeit speichern"}
      </Button>
    </form>
  );
}
