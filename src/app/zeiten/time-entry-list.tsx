"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createManualEntry } from "./actions";
import { TimeEntryForm, type ProjectOption, type UserOption } from "./time-entry-form";
import { TimeEntryRow, type DisplayTimeEntry } from "./time-entry-row";

export function TimeEntryList({
  entries,
  projectOptions,
  userOptions,
  currentUserId,
  isAdminOrPL,
  isWritable,
  defaultProjectId,
  showProject,
}: {
  entries: DisplayTimeEntry[];
  projectOptions: ProjectOption[];
  userOptions: UserOption[];
  currentUserId: string;
  isAdminOrPL: boolean;
  isWritable: boolean;
  defaultProjectId?: string;
  showProject: boolean;
}) {
  const [showCreateForm, setShowCreateForm] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      {isWritable &&
        (showCreateForm ? (
          <div className="rounded-md border border-border p-4">
            <TimeEntryForm
              projectOptions={projectOptions}
              userOptions={userOptions}
              defaultProjectId={defaultProjectId}
              action={createManualEntry}
              onCancel={() => setShowCreateForm(false)}
              onSuccess={() => setShowCreateForm(false)}
              submitLabel="Eintrag speichern"
            />
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowCreateForm(true)}
            className="w-fit"
          >
            + Manuellen Eintrag hinzufügen
          </Button>
        ))}

      {entries.length === 0 && (
        <p className="text-sm text-muted-foreground">Noch keine Zeiteinträge.</p>
      )}
      {entries.map((entry) => (
        <TimeEntryRow
          key={entry.id}
          entry={entry}
          projectOptions={projectOptions}
          userOptions={userOptions}
          canEdit={isWritable && (isAdminOrPL || entry.user_id === currentUserId)}
          showProject={showProject}
          showAuthor={isAdminOrPL}
        />
      ))}
    </div>
  );
}
