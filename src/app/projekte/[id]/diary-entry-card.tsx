"use client";

import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { diaryCategoryLabel, type DiaryEntry } from "@/core/diary/entry";
import { DiaryPhotoThumbnails } from "./diary-photo-lightbox";

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DiaryEntryCard({
  entry,
  correctsSeq,
  correctedBySeq,
  canWrite,
  onCorrect,
}: {
  entry: DiaryEntry;
  correctsSeq: number | null;
  correctedBySeq: number | null;
  canWrite: boolean;
  onCorrect: () => void;
}) {
  const categoryLabel = diaryCategoryLabel(entry.category);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-2 rounded-lg border border-border p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{entry.authorName}</span>
          <span>·</span>
          <span>{formatTimestamp(entry.created_at)}</span>
          {categoryLabel && <Badge>{categoryLabel}</Badge>}
        </div>
        {canWrite && (
          <Button type="button" variant="ghost" size="sm" onClick={onCorrect}>
            Korrigieren
          </Button>
        )}
      </div>

      {correctsSeq !== null && (
        <p className="text-xs text-muted-foreground">Korrigiert Eintrag #{correctsSeq}</p>
      )}
      {correctedBySeq !== null && (
        <p className="text-xs text-muted-foreground">
          Korrigiert durch Eintrag #{correctedBySeq} — dieser Eintrag bleibt unverändert sichtbar.
        </p>
      )}

      {entry.text && <p className="whitespace-pre-wrap text-sm">{entry.text}</p>}

      <DiaryPhotoThumbnails photos={entry.photos} />
    </motion.div>
  );
}
