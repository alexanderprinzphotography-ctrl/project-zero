"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { updateProjectVisibility, type ThemeActionState } from "./actions";

const initialState: ThemeActionState = { error: null, success: false };

export function ProjectVisibilityForm({
  initialValue,
  readOnly,
}: {
  initialValue: string;
  readOnly: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateProjectVisibility, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="projectVisibility"
            value="all"
            defaultChecked={initialValue !== "assigned"}
            disabled={readOnly}
          />
          Alle Rollen sehen alle Projekte der Firma
        </label>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="projectVisibility"
            value="assigned"
            defaultChecked={initialValue === "assigned"}
            disabled={readOnly}
          />
          Mitarbeiter sehen nur zugewiesene Projekte (Admin/Projektleiter sehen immer alle)
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
