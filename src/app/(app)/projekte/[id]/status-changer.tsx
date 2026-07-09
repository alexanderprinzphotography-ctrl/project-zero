"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { PROJECT_STATUSES, projectStatusLabel, type ProjectStatus } from "@/core/projects/project";
import { updateProjectStatus, type ProjectActionState } from "../actions";

const initialState: ProjectActionState = { error: null };

export function StatusChanger({ id, status }: { id: string; status: ProjectStatus }) {
  const [state, formAction, pending] = useActionState(updateProjectStatus, initialState);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <select
        name="status"
        defaultValue={status}
        className="rounded-md border border-input bg-transparent px-2 py-1.5 text-sm"
      >
        {PROJECT_STATUSES.map((s) => (
          <option key={s} value={s}>
            {projectStatusLabel(s)}
          </option>
        ))}
      </select>
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "…" : "Status ändern"}
      </Button>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
