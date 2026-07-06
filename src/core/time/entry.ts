export type TimeEntrySource = "timer" | "manual";

export type TimeEntry = {
  id: string;
  project_id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  break_minutes: number;
  note: string | null;
  entry_source: TimeEntrySource;
};

/**
 * Brutto-Dauer in Sekunden - IMMER aus den absoluten timestamptz-Zeitpunkten
 * berechnet (nie aus lokalen Wanduhr-Differenzen), dadurch automatisch
 * korrekt ueber Sommer-/Winterzeit-Umstellungen hinweg.
 */
export function grossSeconds(startedAt: string, endedAt: string): number {
  return (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000;
}

/** Netto-Dauer in Sekunden = Brutto - Pause. Keine Rundung. */
export function netSeconds(startedAt: string, endedAt: string, breakMinutes: number): number {
  return grossSeconds(startedAt, endedAt) - breakMinutes * 60;
}

/**
 * Formatiert Sekunden als "H:MM". Rundet (per Abschneiden auf volle Minuten)
 * NUR an dieser einen Stelle, am Ende der Anzeige - Summen muessen vorher
 * immer aus den exakten Sekundenwerten gebildet werden, nie aus bereits
 * formatierten/gerundeten Einzelwerten.
 */
export function formatDurationHM(totalSeconds: number): string {
  const totalMinutes = Math.floor(Math.max(0, totalSeconds) / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}`;
}

/** Ueberlappen sich zwei Zeitraeume? Ein offenes Ende (laufender Timer) gilt als "bis jetzt/unbegrenzt". */
export function intervalsOverlap(
  aStart: string,
  aEnd: string | null,
  bStart: string,
  bEnd: string | null,
): boolean {
  const aStartMs = new Date(aStart).getTime();
  const aEndMs = aEnd ? new Date(aEnd).getTime() : Infinity;
  const bStartMs = new Date(bStart).getTime();
  const bEndMs = bEnd ? new Date(bEnd).getTime() : Infinity;
  return aStartMs < bEndMs && bStartMs < aEndMs;
}

/** Live-Anzeige des laufenden Timers (mit Sekunden) - separat von formatDurationHM, das fuer abgeschlossene Eintraege/Summen gilt. */
export function formatElapsedHMS(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function entrySourceLabel(source: TimeEntrySource): string {
  return source === "timer" ? "Timer" : "Manuell";
}

/**
 * Zeigt einen Zeitpunkt explizit in Europe/Berlin an - unabhaengig von der
 * Server-Zeitzone (z. B. Vercel/Node laeuft oft in UTC), damit die Anzeige auf
 * jeder Umgebung gleich bleibt.
 */
export function formatBerlinDateTime(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", {
    timeZone: "Europe/Berlin",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Wandelt einen gespeicherten UTC-Zeitpunkt in einen fuer <input type="datetime-local">
 * passenden String um - explizit in Europe/Berlin, nicht in Server-Lokalzeit.
 * Fuers Vorbefuellen von Bearbeiten-Formularen.
 */
export function toBerlinDateTimeLocalValue(iso: string): string {
  const date = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}
