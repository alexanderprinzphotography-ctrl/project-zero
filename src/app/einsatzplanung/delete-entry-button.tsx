"use client";

import { useActionState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { type ScheduleActionState } from "./actions";

const INITIAL_STATE: ScheduleActionState = {
  error: null,
  warning: null,
  blocked: null,
  absenceOverridden: false,
  successAt: null,
};

export function DeleteScheduleEntryButton({
  id,
  deleteAction,
  onSuccess,
}: {
  id: string;
  deleteAction: (prevState: ScheduleActionState, formData: FormData) => Promise<ScheduleActionState>;
  onSuccess: () => void;
}) {
  const [state, formAction, pending] = useActionState(deleteAction, INITIAL_STATE);

  useEffect(() => {
    if (state.successAt) onSuccess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.successAt]);

  return (
    <form action={formAction} className="flex flex-col items-start gap-1">
      <input type="hidden" name="id" value={id} />
      <Button type="submit" variant="destructive" size="sm" disabled={pending}>
        {pending ? "Wird gelöscht…" : "Eintrag löschen"}
      </Button>
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
    </form>
  );
}
