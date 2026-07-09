"use client";

import { useMemo, useState } from "react";
import type { DiaryEntry } from "@/core/diary/entry";
import { DiaryEntryForm, type CorrectingEntry } from "./diary-entry-form";
import { DiaryEntryCard } from "./diary-entry-card";
import { DiaryVerifyButton } from "./diary-verify-button";

function dateKey(value: string): string {
  return new Date(value).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

type EntryWithGrouping = {
  entry: DiaryEntry;
  dateLabel: string;
  showDateSeparator: boolean;
  correctsSeq: number | null;
  correctedBySeq: number | null;
};

export function DiarySection({
  projectId,
  entries,
  canWrite,
  isWritable,
  canVerify,
}: {
  projectId: string;
  entries: DiaryEntry[];
  canWrite: boolean;
  isWritable: boolean;
  canVerify: boolean;
}) {
  const [correctingEntry, setCorrectingEntry] = useState<CorrectingEntry | null>(null);

  const groupedEntries = useMemo<EntryWithGrouping[]>(() => {
    const seqById = new Map<string, number>();
    const correctedByMap = new Map<string, number>();
    for (const entry of entries) {
      seqById.set(entry.id, entry.seq);
    }
    for (const entry of entries) {
      if (entry.corrects_entry_id) {
        correctedByMap.set(entry.corrects_entry_id, entry.seq);
      }
    }

    return entries.map((entry, index) => {
      const label = dateKey(entry.created_at);
      const prevLabel = index > 0 ? dateKey(entries[index - 1].created_at) : null;
      return {
        entry,
        dateLabel: label,
        showDateSeparator: label !== prevLabel,
        correctsSeq: entry.corrects_entry_id ? (seqById.get(entry.corrects_entry_id) ?? null) : null,
        correctedBySeq: correctedByMap.get(entry.id) ?? null,
      };
    });
  }, [entries]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">Bautagebuch</h3>
        {canVerify && <DiaryVerifyButton projectId={projectId} />}
      </div>

      {canWrite ? (
        isWritable ? (
          <DiaryEntryForm
            projectId={projectId}
            correctingEntry={correctingEntry}
            onCancelCorrection={() => setCorrectingEntry(null)}
          />
        ) : (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Testphase abgelaufen – neue Tagebuch-Einträge sind gesperrt. Lesen bleibt möglich.
          </p>
        )
      ) : null}

      <div className="flex flex-col gap-3">
        {groupedEntries.length === 0 && (
          <p className="text-sm text-muted-foreground">Noch keine Einträge.</p>
        )}
        {groupedEntries.map(({ entry, dateLabel, showDateSeparator, correctsSeq, correctedBySeq }) => (
          <div key={entry.id} className="flex flex-col gap-3">
            {showDateSeparator && (
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <div className="h-px flex-1 bg-border" />
                {dateLabel}
                <div className="h-px flex-1 bg-border" />
              </div>
            )}
            <DiaryEntryCard
              entry={entry}
              correctsSeq={correctsSeq}
              correctedBySeq={correctedBySeq}
              canWrite={canWrite && isWritable}
              onCorrect={() => setCorrectingEntry({ id: entry.id, seq: entry.seq, text: entry.text })}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
