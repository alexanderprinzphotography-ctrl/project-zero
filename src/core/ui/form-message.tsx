"use client";

import { useEffect } from "react";
import { toast } from "sonner";

/**
 * Einheitliche Fehler-/Erfolgs-Anzeige fuer Server-Action-Rueckgaben - ersetzt
 * die bisher pro Formular duplizierten Inline-Meldungen. Fehler bleiben
 * inline sichtbar (persistent, direkt am Formular); Erfolg erscheint dezent
 * als Toast statt einer weiteren dauerhaften Box im Layout (siehe MS 10a,
 * Prioritaet 4 - unaufdringliches Feedback).
 */
export function FormMessage({ error, success }: { error?: string | null; success?: string | null }) {
  useEffect(() => {
    if (success) toast.success(success);
  }, [success]);

  if (error) {
    return <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>;
  }
  return null;
}
