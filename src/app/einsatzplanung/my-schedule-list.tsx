"use client";

import {
  absenceKindLabel,
  entryOverlapsDay,
  formatDateShort,
  formatWeekdayShort,
  type ScheduleEntry,
} from "@/core/schedule/entry";

export function MyScheduleList({
  days,
  entries,
}: {
  days: string[];
  entries: (ScheduleEntry & { projectLabel: string | null })[];
}) {
  return (
    <div className="flex flex-col gap-2">
      {days.map((d) => {
        const dayEntries = entries.filter((e) => entryOverlapsDay(e, d));
        return (
          <div key={d} className="rounded-md border border-border p-3">
            <div className="mb-2 text-sm font-medium">
              {formatWeekdayShort(d)}, {formatDateShort(d)}
            </div>
            {dayEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nichts eingeplant.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {dayEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className={`rounded px-2 py-1.5 text-sm ${
                      entry.type === "abwesenheit"
                        ? "bg-destructive/15 text-destructive"
                        : "bg-primary/15 text-primary"
                    }`}
                  >
                    <span className="font-medium">
                      {entry.type === "abwesenheit"
                        ? absenceKindLabel(entry.absence_kind ?? "sonstiges")
                        : (entry.projectLabel ?? "Unbekannt")}
                    </span>
                    {" · "}
                    {entry.mode === "ganztags"
                      ? "Ganztags"
                      : entry.mode === "halbtags"
                        ? entry.half_day_slot === "nachmittag"
                          ? "Nachmittag"
                          : "Vormittag"
                        : "Uhrzeit"}
                    {entry.note && <p className="mt-1 text-xs opacity-80">{entry.note}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
