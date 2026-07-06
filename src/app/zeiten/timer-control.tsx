"use client";

import { useActionState, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { formatElapsedHMS } from "@/core/time/entry";
import { startTimer, stopTimer, type TimeActionState } from "./actions";

const initialState: TimeActionState = { error: null, warning: null, successAt: null };

function StartTimerButton({ projectId }: { projectId: string }) {
  const [state, formAction, pending] = useActionState(startTimer, initialState);

  return (
    <form action={formAction} className="flex flex-col items-start gap-1">
      <input type="hidden" name="projectId" value={projectId} />
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "…" : "Start"}
      </Button>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}

function RunningTimer({ entryId, startedAt }: { entryId: string; startedAt: string }) {
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
    <form action={formAction} className="flex flex-col items-start gap-1">
      <input type="hidden" name="entryId" value={entryId} />
      <div className="flex items-center gap-3">
        <motion.span
          animate={{ opacity: [1, 0.4, 1] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="flex items-center gap-2 rounded-full bg-destructive/10 px-3 py-1.5 text-sm font-medium text-destructive"
        >
          ● Läuft seit {formatElapsedHMS(elapsed)}
        </motion.span>
        <Button type="submit" variant="outline" size="sm" disabled={pending}>
          {pending ? "…" : "Stopp"}
        </Button>
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}

export function TimerControl({
  projectId,
  runningEntry,
}: {
  projectId: string;
  runningEntry: { id: string; started_at: string } | null;
}) {
  if (runningEntry) {
    return <RunningTimer entryId={runningEntry.id} startedAt={runningEntry.started_at} />;
  }
  return <StartTimerButton projectId={projectId} />;
}
