"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { removeProjectMember, type ProjectActionState } from "../actions";

const initialState: ProjectActionState = { error: null };

export function RemoveMemberButton({
  memberId,
  projectId,
}: {
  memberId: string;
  projectId: string;
}) {
  const [state, formAction, pending] = useActionState(removeProjectMember, initialState);

  return (
    <form action={formAction} className="inline-flex flex-col items-start gap-1">
      <input type="hidden" name="memberId" value={memberId} />
      <input type="hidden" name="projectId" value={projectId} />
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        {pending ? "…" : "Entfernen"}
      </Button>
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
    </form>
  );
}
