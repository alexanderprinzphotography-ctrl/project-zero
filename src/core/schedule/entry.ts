export type ScheduleEntryType = "einsatz" | "abwesenheit";
export type AbsenceKind = "urlaub" | "krank" | "sonstiges";
export type ScheduleMode = "ganztags" | "halbtags" | "uhrzeit";
export type HalfDaySlot = "vormittag" | "nachmittag";

export type ScheduleEntry = {
  id: string;
  user_id: string;
  type: ScheduleEntryType;
  project_id: string | null;
  absence_kind: AbsenceKind | null;
  mode: ScheduleMode;
  half_day_slot: HalfDaySlot | null;
  starts_at: string;
  ends_at: string;
  note: string | null;
};

export function absenceKindLabel(kind: AbsenceKind): string {
  switch (kind) {
    case "urlaub":
      return "Urlaub";
    case "krank":
      return "Krank";
    case "sonstiges":
      return "Sonstiges";
  }
}

export function scheduleModeLabel(mode: ScheduleMode): string {
  switch (mode) {
    case "ganztags":
      return "Ganztags";
    case "halbtags":
      return "Halbtags";
    case "uhrzeit":
      return "Uhrzeit";
  }
}

// Standard-Arbeitszeiten (Europe/Berlin-Ortszeit) fuer ganztags/halbtags -
// werden im Browser mit dem gewaehlten Datum kombiniert und dort erst in UTC
// umgewandelt (siehe combineLocalDateAndTime), analog zum DST-sicheren Muster
// aus MS 6.
export const GANZTAGS_START = "08:00";
export const GANZTAGS_END = "17:00";
export const VORMITTAG_START = "08:00";
export const VORMITTAG_END = "13:00";
export const NACHMITTAG_START = "13:00";
export const NACHMITTAG_END = "17:00";

/** Kombiniert ein lokales Datum + lokale Uhrzeit zu einem UTC-ISO-String - MUSS im Browser laufen (lokale lokale Zeitzone des Nutzers, siehe MS 6). */
export function combineLocalDateAndTime(dateStr: string, timeStr: string): string {
  return new Date(`${dateStr}T${timeStr}`).toISOString();
}

export function computeStandardRange(
  dateStr: string,
  mode: "ganztags" | "halbtags",
  halfDaySlot?: HalfDaySlot,
): { startsAt: string; endsAt: string } {
  if (mode === "ganztags") {
    return {
      startsAt: combineLocalDateAndTime(dateStr, GANZTAGS_START),
      endsAt: combineLocalDateAndTime(dateStr, GANZTAGS_END),
    };
  }
  if (halfDaySlot === "nachmittag") {
    return {
      startsAt: combineLocalDateAndTime(dateStr, NACHMITTAG_START),
      endsAt: combineLocalDateAndTime(dateStr, NACHMITTAG_END),
    };
  }
  return {
    startsAt: combineLocalDateAndTime(dateStr, VORMITTAG_START),
    endsAt: combineLocalDateAndTime(dateStr, VORMITTAG_END),
  };
}

// ---------------------------------------------------------------------------
// Wochen-/Kalendernavigation: reine Kalenderdatums-Arithmetik ueber UTC-Methoden,
// damit sie unabhaengig von der Server-/Browser-Zeitzone IMMER dasselbe
// Kalenderdatum liefert (anders als die Dauer-Berechnung oben geht es hier nie
// um einen realen Zeitpunkt, sondern nur um Jahr/Monat/Tag).
// ---------------------------------------------------------------------------

function toDateKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getMondayOfWeek(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return toDateKey(d);
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return toDateKey(d);
}

export function todayDateKey(): string {
  return toDateKey(new Date());
}

export function formatWeekdayShort(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString("de-DE", {
    weekday: "short",
    timeZone: "UTC",
  });
}

/** Europe/Berlin-Kalendertag (YYYY-MM-DD) eines gespeicherten UTC-Zeitpunkts - fuers Vorbefuellen von <input type="date">. */
export function toBerlinDateKey(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date(iso));
}

export function formatDateShort(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  });
}

/** Ueberlappen sich zwei Zeitraeume (halboffenes Intervall [start, end))? */
export function intervalsOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return new Date(aStart).getTime() < new Date(bEnd).getTime() && new Date(bStart).getTime() < new Date(aEnd).getTime();
}

/** Beruehrt der Eintrag den Europe/Berlin-Kalendertag dateStr? Fuer die Zuordnung in Raster-/Listenzellen - MUSS im Browser laufen (siehe combineLocalDateAndTime). */
export function entryOverlapsDay(entry: { starts_at: string; ends_at: string }, dateStr: string): boolean {
  const dayStart = combineLocalDateAndTime(dateStr, "00:00");
  const dayEnd = combineLocalDateAndTime(addDays(dateStr, 1), "00:00");
  return intervalsOverlap(entry.starts_at, entry.ends_at, dayStart, dayEnd);
}
