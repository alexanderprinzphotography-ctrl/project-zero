"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { acceptAsLoggedInUser, type InviteActionState } from "./actions";

const initialState: InviteActionState = { error: null, info: null };

export function JoinDirectlyForm({ token }: { token: string }) {
  const bound = acceptAsLoggedInUser.bind(null, token);
  const [state, formAction, pending] = useActionState(bound, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input
        name="fullName"
        type="text"
        placeholder="Name"
        required
        className="rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
      />
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Wird beigetreten…" : "Firma beitreten"}
      </Button>
    </form>
  );
}
