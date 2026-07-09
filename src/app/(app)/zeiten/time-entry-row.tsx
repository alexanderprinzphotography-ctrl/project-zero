"use client";

import { useActionState, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ListRow } from "@/core/ui/list";
import { formatBerlinDateTime, formatDurationHM, netSeconds, type TimeEntry } from "@/core/time/entry";
import { deleteTimeEntry, updateTimeEntry, type TimeActionState } from "./actions";
import { TimeEntryForm, type ProjectOption, type UserOption } from "./time-entry-form";

const initialState: TimeActionState = { error: null, warning: null, successAt: null };

export type DisplayTimeEntry = TimeEntry & {
  authorName?: string;
  projectLabel?: string;
};

function DeleteTimeEntryButton({ id, projectId }: { id: string; projectId: string }) {
  const [state, formAction, pending] = useActionState(deleteTimeEntry, initialState);

  return (
    <form action={formAction} className="inline-flex flex-col items-end gap-1">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="projectId" value={projectId} />
      <Button type="submit" variant="ghost" size="sm" disabled={pending}>
        {pending ? "…" : "Löschen"}
      </Button>
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
    </form>
  );
}

export function TimeEntryRow({
  entry,
  projectOptions,
  userOptions,
  canEdit,
  showProject,
  showAuthor,
}: {
  entry: DisplayTimeEntry;
  projectOptions: ProjectOption[];
  userOptions: UserOption[];
  canEdit: boolean;
  showProject: boolean;
  showAuthor: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);

  if (isEditing) {
    const boundUpdate = updateTimeEntry.bind(null, entry.id);
    return (
      <Card>
        <CardHeader>
          <CardTitle>Zeiteintrag bearbeiten</CardTitle>
        </CardHeader>
        <CardContent>
          <TimeEntryForm
            entry={entry}
            projectOptions={projectOptions}
            userOptions={userOptions}
            action={boundUpdate}
            onCancel={() => setIsEditing(false)}
            onSuccess={() => setIsEditing(false)}
            submitLabel="Änderungen speichern"
          />
        </CardContent>
      </Card>
    );
  }

  const net = entry.ended_at ? netSeconds(entry.started_at, entry.ended_at, entry.break_minutes) : null;

  return (
    <ListRow>
      <div className="grid w-full grid-cols-[1fr_auto] items-center gap-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            {showAuthor && entry.authorName && (
              <span className="font-medium">{entry.authorName}</span>
            )}
            {showProject && entry.projectLabel && (
              <Badge variant="default">{entry.projectLabel}</Badge>
            )}
            <span className="text-muted-foreground">
              {formatBerlinDateTime(entry.started_at)} –{" "}
              {entry.ended_at ? formatBerlinDateTime(entry.ended_at) : "läuft"}
            </span>
          </div>
          {entry.note && <p className="text-muted-foreground">{entry.note}</p>}
        </div>
        <div className="flex items-center gap-3">
          <span className="font-medium">
            {net !== null ? formatDurationHM(net) : "…"}
            {entry.break_minutes > 0 && (
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                (−{entry.break_minutes} Min. Pause)
              </span>
            )}
          </span>
          {canEdit && entry.ended_at && (
            <>
              <Button type="button" variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
                Bearbeiten
              </Button>
              <DeleteTimeEntryButton id={entry.id} projectId={entry.project_id} />
            </>
          )}
        </div>
      </div>
    </ListRow>
  );
}
