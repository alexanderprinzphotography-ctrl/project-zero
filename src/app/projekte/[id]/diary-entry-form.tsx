"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { DIARY_CATEGORIES, diaryCategoryLabel } from "@/core/diary/entry";
import { createDiaryEntry, type DiaryActionState } from "./diary-actions";

const initialState: DiaryActionState = { error: null, successAt: null };

const fieldClass =
  "rounded-md border border-input bg-transparent px-3 py-2 text-base outline-none focus:ring-2 focus:ring-ring";

export type CorrectingEntry = { id: string; seq: number; text: string | null };

function DiaryPhotoPicker() {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  function syncInputFiles(nextFiles: File[]) {
    const dt = new DataTransfer();
    nextFiles.forEach((f) => dt.items.add(f));
    if (inputRef.current) inputRef.current.files = dt.files;
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    setFiles(selected);
    setPreviews((prev) => {
      prev.forEach((url) => URL.revokeObjectURL(url));
      return selected.map((f) => URL.createObjectURL(f));
    });
  }

  function removeFileAt(index: number) {
    const next = files.filter((_, i) => i !== index);
    setFiles(next);
    setPreviews((prev) => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
    syncInputFiles(next);
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium">Fotos</label>
      <input
        ref={inputRef}
        type="file"
        name="photos"
        accept="image/*"
        multiple
        onChange={handleFileChange}
        className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-primary-foreground"
      />
      {previews.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {previews.map((url, i) => (
            <div
              key={url}
              className="relative aspect-square overflow-hidden rounded-md border border-border"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- lokale Object-URL-Vorschau */}
              <img src={url} alt={`Vorschau ${i + 1}`} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removeFileAt(i)}
                className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-sm text-white"
                aria-label="Foto entfernen"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function DiaryEntryForm({
  projectId,
  correctingEntry,
  onCancelCorrection,
}: {
  projectId: string;
  correctingEntry: CorrectingEntry | null;
  onCancelCorrection: () => void;
}) {
  const boundAction = createDiaryEntry.bind(null, projectId);
  const [state, formAction, pending] = useActionState(boundAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  // Nach erfolgreichem Absenden: Textfelder per DOM-Reset zuruecksetzen, die
  // Fotoauswahl wird ueber den key-Wechsel auf DiaryPhotoPicker neu montiert
  // (kein setState im Effect noetig).
  useEffect(() => {
    if (state.successAt) {
      formRef.current?.reset();
      onCancelCorrection();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.successAt]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      {correctingEntry && (
        <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2 text-sm">
          <span>
            Korrigiert Eintrag #{correctingEntry.seq}
            {correctingEntry.text ? `: „${correctingEntry.text.slice(0, 60)}“` : ""}
          </span>
          <button
            type="button"
            onClick={onCancelCorrection}
            className="text-muted-foreground underline hover:text-foreground"
          >
            Abbrechen
          </button>
        </div>
      )}
      <input type="hidden" name="correctsEntryId" value={correctingEntry?.id ?? ""} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="category" className="text-sm font-medium">
          Kategorie (optional)
        </label>
        <select id="category" name="category" defaultValue="" className={fieldClass}>
          <option value="">Keine</option>
          {DIARY_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {diaryCategoryLabel(c)}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="text" className="text-sm font-medium">
          Text
        </label>
        <textarea
          id="text"
          name="text"
          rows={4}
          placeholder="Was gibt es zu berichten?"
          className={fieldClass}
        />
      </div>

      <DiaryPhotoPicker key={state.successAt ?? 0} />

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <AnimatePresence>
        {pending && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 text-sm text-muted-foreground"
          >
            <motion.span
              className="h-4 w-4 rounded-full border-2 border-muted-foreground border-t-transparent"
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
            />
            Wird hochgeladen und gespeichert…
          </motion.div>
        )}
      </AnimatePresence>

      <Button type="submit" size="lg" disabled={pending} className="w-fit">
        {pending
          ? "Wird gespeichert…"
          : correctingEntry
            ? "Korrektur speichern"
            : "Eintrag speichern"}
      </Button>
    </form>
  );
}
