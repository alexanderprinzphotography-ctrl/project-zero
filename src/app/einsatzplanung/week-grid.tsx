"use client";

import { type ReactNode, useState } from "react";
import {
  absenceKindLabel,
  entryOverlapsDay,
  formatDateShort,
  formatWeekdayShort,
  type ScheduleEntry,
} from "@/core/schedule/entry";
import { createScheduleEntry, updateScheduleEntry, deleteScheduleEntry } from "./actions";
import { ScheduleEntryForm, type ProjectOption, type UserOption } from "./entry-form";
import { DeleteScheduleEntryButton } from "./delete-entry-button";

export type GridEntry = ScheduleEntry & { projectLabel: string | null };

function Modal({ isOpen, onClose, children }: { isOpen: boolean; onClose: () => void; children: ReactNode }) {
  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-background p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

type ModalState =
  | { mode: "create"; userId: string; dateStr: string }
  | { mode: "edit"; entry: GridEntry }
  | null;

export function WeekGrid({
  days,
  employees,
  entries,
  projectOptions,
  userOptions,
  canEdit,
}: {
  days: string[];
  employees: UserOption[];
  entries: GridEntry[];
  projectOptions: ProjectOption[];
  userOptions: UserOption[];
  canEdit: boolean;
}) {
  const [modalState, setModalState] = useState<ModalState>(null);

  function entriesFor(userId: string, dateStr: string): GridEntry[] {
    return entries.filter((e) => e.user_id === userId && entryOverlapsDay(e, dateStr));
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full min-w-[700px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="sticky left-0 bg-background p-2 text-left">Mitarbeiter</th>
            {days.map((d) => (
              <th key={d} className="min-w-[130px] p-2 text-center font-medium">
                <div>{formatWeekdayShort(d)}</div>
                <div className="text-xs font-normal text-muted-foreground">{formatDateShort(d)}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {employees.length === 0 ? (
            <tr>
              <td colSpan={days.length + 1} className="p-4 text-center text-muted-foreground">
                Keine Mitarbeiter gefunden.
              </td>
            </tr>
          ) : (
            employees.map((emp) => (
              <tr key={emp.id} className="border-b border-border last:border-0">
                <td className="sticky left-0 bg-background p-2 align-top font-medium">{emp.label}</td>
                {days.map((d) => {
                  const dayEntries = entriesFor(emp.id, d);
                  return (
                    <td key={d} className="border-l border-border p-1.5 align-top">
                      <div className="flex flex-col gap-1">
                        {dayEntries.map((entry) => (
                          <button
                            key={entry.id}
                            type="button"
                            disabled={!canEdit}
                            onClick={() => canEdit && setModalState({ mode: "edit", entry })}
                            className={`w-full rounded px-1.5 py-1 text-left text-xs leading-tight ${
                              entry.type === "abwesenheit"
                                ? "bg-destructive/15 text-destructive"
                                : "bg-primary/15 text-primary"
                            } ${canEdit ? "hover:opacity-80" : "cursor-default"}`}
                          >
                            <div className="font-medium">
                              {entry.type === "abwesenheit"
                                ? absenceKindLabel(entry.absence_kind ?? "sonstiges")
                                : (entry.projectLabel ?? "Unbekannt")}
                            </div>
                            {entry.mode !== "ganztags" && (
                              <div className="opacity-70">
                                {entry.mode === "halbtags"
                                  ? entry.half_day_slot === "nachmittag"
                                    ? "Nachmittag"
                                    : "Vormittag"
                                  : "Uhrzeit"}
                              </div>
                            )}
                          </button>
                        ))}
                        {canEdit && (
                          <button
                            type="button"
                            onClick={() => setModalState({ mode: "create", userId: emp.id, dateStr: d })}
                            className="rounded px-1.5 py-1 text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                          >
                            + hinzufügen
                          </button>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>

      <Modal isOpen={modalState !== null} onClose={() => setModalState(null)}>
        {modalState?.mode === "create" && (
          <ScheduleEntryForm
            defaultUserId={modalState.userId}
            defaultDateStr={modalState.dateStr}
            userOptions={userOptions}
            projectOptions={projectOptions}
            action={createScheduleEntry}
            onCancel={() => setModalState(null)}
            onSuccess={() => setModalState(null)}
            submitLabel="Einplanen"
          />
        )}
        {modalState?.mode === "edit" && (
          <div className="flex flex-col gap-4">
            <ScheduleEntryForm
              entry={modalState.entry}
              userOptions={userOptions}
              projectOptions={projectOptions}
              action={updateScheduleEntry.bind(null, modalState.entry.id)}
              onCancel={() => setModalState(null)}
              onSuccess={() => setModalState(null)}
              submitLabel="Änderungen speichern"
            />
            <div className="border-t border-border pt-4">
              <DeleteScheduleEntryButton
                id={modalState.entry.id}
                deleteAction={deleteScheduleEntry}
                onSuccess={() => setModalState(null)}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
