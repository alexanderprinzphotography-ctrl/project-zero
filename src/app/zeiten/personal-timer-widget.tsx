"use client";

import { useActionState, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { formatElapsedHMS } from "@/core/time/entry";
import { startTimer, stopTimer, type TimeActionState } from "./actions";
import type { ProjectOption } from "./time-entry-form";

const initialState: TimeActionState = { error: null, warning: null, successAt: null };

function StartTimerWithPicker({ projectOptions }: { projectOptions: ProjectOption[] }) {
  const [selectedProject, setSelectedProject] = useState(projectOptions[0]?.id ?? "");
  const [state, formAction, pending] = useActionState(startTimer, initialState);

  if (projectOptions.length === 0) {
    return <p className="text-sm text-muted-foreground">Keine Projekte sichtbar.</p>;
  }

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <select
        name="projectId"
        value={selectedProject}
        onChange={(e) => setSelectedProject(e.target.value)}
        className="rounded-md border border-input bg-transparent px-3 py-2 text-sm"
      >
        {projectOptions.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>
      <Button type="submit" size="lg" disabled={pending || !selectedProject}>
        {pending ? "…" : "Start"}
      </Button>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}

function RunningTimer({
  entryId,
  startedAt,
  projectLabel,
}: {
  entryId: string;
  startedAt: string;
  projectLabel: string;
}) {
  const [state, formAction, pending] = useActionState(stopTimer, initialState);
  const [elapsed, setElapsed] = useState(() =>
    Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000),
  );

  useEffect(() => {
    const startMs = new Date(startedAt).getTime();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startMs) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="entryId" value={entryId} />
      <motion.span
        animate={{ opacity: [1, 0.4, 1] }}
        transition={{ repeat: Infinity, duration: 2 }}
        className="flex items-center gap-2 rounded-full bg-destructive/10 px-3 py-1.5 text-sm font-medium text-destructive"
      >
        ● {projectLabel} – läuft seit {formatElapsedHMS(elapsed)}
      </motion.span>
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? "…" : "Stopp"}
      </Button>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}

export function PersonalTimerWidget({
  projectOptions,
  runningEntry,
}: {
  projectOptions: ProjectOption[];
  runningEntry: { id: string; started_at: string; projectLabel: string } | null;
}) {
  if (runningEntry) {
    return (
      <RunningTimer
        entryId={runningEntry.id}
        startedAt={runningEntry.started_at}
        projectLabel={runningEntry.projectLabel}
      />
    );
  }
  return <StartTimerWithPicker projectOptions={projectOptions} />;
}
