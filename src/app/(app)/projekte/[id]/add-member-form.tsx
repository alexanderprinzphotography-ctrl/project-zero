"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { addProjectMember, type ProjectActionState } from "../actions";

const initialState: ProjectActionState = { error: null };

export type AssignableUser = { id: string; full_name: string | null; email: string | null };

export function AddMemberForm({
  projectId,
  availableUsers,
}: {
  projectId: string;
  availableUsers: AssignableUser[];
}) {
  const [state, formAction, pending] = useActionState(addProjectMember, initialState);

  if (availableUsers.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Alle Firmenmitglieder sind bereits zugewiesen.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="projectId" value={projectId} />
      <select
        name="userId"
        defaultValue=""
        required
        className="rounded-md border border-input bg-transparent px-2 py-1.5 text-sm"
      >
        <option value="" disabled>
          Person wählen…
        </option>
        {availableUsers.map((u) => (
          <option key={u.id} value={u.id}>
            {u.full_name ?? u.email ?? u.id}
          </option>
        ))}
      </select>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "…" : "Zuweisen"}
      </Button>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
