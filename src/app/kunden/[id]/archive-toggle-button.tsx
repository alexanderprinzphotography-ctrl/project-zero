"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { setContactArchived, type ContactActionState } from "../actions";

const initialState: ContactActionState = { error: null };

export function ArchiveToggleButton({ id, isArchived }: { id: string; isArchived: boolean }) {
  const [state, formAction, pending] = useActionState(setContactArchived, initialState);

  return (
    <form action={formAction} className="flex flex-col items-start gap-1">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="archived" value={String(!isArchived)} />
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? "…" : isArchived ? "Wiederherstellen" : "Archivieren"}
      </Button>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
