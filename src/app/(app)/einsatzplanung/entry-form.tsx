"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/core/ui/field";
import { FormMessage } from "@/core/ui/form-message";
import { toBerlinDateTimeLocalValue } from "@/core/time/entry";
import {
  computeStandardRange,
  scheduleModeLabel,
  toBerlinDateKey,
  type AbsenceKind,
  type HalfDaySlot,
  type ScheduleEntry,
  type ScheduleEntryType,
  type ScheduleMode,
} from "@/core/schedule/entry";
import { type ScheduleActionState } from "./actions";

const selectClass = "h-10 rounded-md border border-input bg-transparent px-3 text-sm";

export type ProjectOption = { id: string; label: string };
export type UserOption = { id: string; label: string };

const INITIAL_STATE: ScheduleActionState = {
  error: null,
  warning: null,
  blocked: null,
  absenceOverridden: false,
  successAt: null,
};

export function ScheduleEntryForm({
  entry,
  defaultUserId,
  defaultDateStr,
  userOptions,
  projectOptions,
  action,
  onCancel,
  onSuccess,
  submitLabel,
}: {
  entry?: ScheduleEntry;
  defaultUserId?: string;
  defaultDateStr?: string;
  userOptions: UserOption[];
  projectOptions: ProjectOption[];
  action: (prevState: ScheduleActionState, formData: FormData) => Promise<ScheduleActionState>;
  onCancel?: () => void;
  onSuccess?: () => void;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL_STATE);

  const [userId, setUserId] = useState(entry?.user_id ?? defaultUserId ?? "");
  const [type, setType] = useState<ScheduleEntryType>(entry?.type ?? "einsatz");
  const [projectId, setProjectId] = useState(entry?.project_id ?? "");
  const [absenceKind, setAbsenceKind] = useState<AbsenceKind>(entry?.absence_kind ?? "urlaub");
  const [mode, setMode] = useState<ScheduleMode>(entry?.mode ?? "ganztags");
  const [halfDaySlot, setHalfDaySlot] = useState<HalfDaySlot>(entry?.half_day_slot ?? "vormittag");
  const [dateStr, setDateStr] = useState(
    entry ? toBerlinDateKey(entry.starts_at) : (defaultDateStr ?? ""),
  );
  const [startLocal, setStartLocal] = useState(entry ? toBerlinDateTimeLocalValue(entry.starts_at) : "");
  const [endLocal, setEndLocal] = useState(entry ? toBerlinDateTimeLocalValue(entry.ends_at) : "");
  const [note, setNote] = useState(entry?.note ?? "");

  useEffect(() => {
    if (state.successAt) onSuccess?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.successAt]);

  let startsAtIso = "";
  let endsAtIso = "";
  if (mode === "uhrzeit") {
    startsAtIso = startLocal ? new Date(startLocal).toISOString() : "";
    endsAtIso = endLocal ? new Date(endLocal).toISOString() : "";
  } else if (dateStr) {
    const range = computeStandardRange(dateStr, mode, halfDaySlot);
    startsAtIso = range.startsAt;
    endsAtIso = range.endsAt;
  }

  return (
    <form
      action={formAction}
      // React setzt das Formular nach JEDEM Action-Aufruf nativ zurueck (auch
      // bei einer reinen Warnung/Block statt echtem Erfolg). Bei <select>/Radio
      // greift dieser native Reset auf die DOM-Ebene durch, OBWOHL die Felder
      // React-kontrolliert sind (anders als bei Text-/datetime-local-Feldern) -
      // sonst koennte z. B. nach einer Doppelbelegungs-Warnung "Trotzdem
      // speichern" den falschen Mitarbeiter/Projekt speichern. Das native
      // reset-Event abfangen und verhindern behebt das robust fuer alle
      // Feldtypen, ohne sich auf Interna von React-Feld-fuer-Feld zu verlassen.
      onReset={(e) => e.preventDefault()}
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="startsAt" value={startsAtIso} readOnly />
      <input type="hidden" name="endsAt" value={endsAtIso} readOnly />
      {/* state.absenceOverridden kommt direkt vom letzten Action-Aufruf zurueck
          (useActionState haelt es ueber Renders hinweg) - kein zusaetzlicher
          lokaler State/Effect noetig, um es "sticky" zu machen. */}
      {state.absenceOverridden && (
        <input type="hidden" name="confirmAbsenceOverride" value="true" readOnly />
      )}

      <Field label="Mitarbeiter" htmlFor="userId">
        <select
          id="userId"
          name="userId"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          required
          className={selectClass}
        >
          <option value="" disabled>
            Mitarbeiter wählen…
          </option>
          {userOptions.map((u) => (
            <option key={u.id} value={u.id}>
              {u.label}
            </option>
          ))}
        </select>
      </Field>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Typ</span>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="type"
              value="einsatz"
              checked={type === "einsatz"}
              onChange={() => setType("einsatz")}
            />
            Einsatz
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="type"
              value="abwesenheit"
              checked={type === "abwesenheit"}
              onChange={() => setType("abwesenheit")}
            />
            Abwesenheit
          </label>
        </div>
      </div>

      {type === "einsatz" ? (
        <Field label="Projekt" htmlFor="projectId">
          <select
            id="projectId"
            name="projectId"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            required
            className={selectClass}
          >
            <option value="" disabled>
              Projekt wählen…
            </option>
            {projectOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
      ) : (
        <Field label="Abwesenheitsart" htmlFor="absenceKind">
          <select
            id="absenceKind"
            name="absenceKind"
            value={absenceKind}
            onChange={(e) => setAbsenceKind(e.target.value as AbsenceKind)}
            className={selectClass}
          >
            <option value="urlaub">Urlaub</option>
            <option value="krank">Krank</option>
            <option value="sonstiges">Sonstiges</option>
          </select>
        </Field>
      )}

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Modus</span>
        <div className="flex gap-4 text-sm">
          {(["ganztags", "halbtags", "uhrzeit"] as ScheduleMode[]).map((m) => (
            <label key={m} className="flex items-center gap-2">
              <input type="radio" name="mode" value={m} checked={mode === m} onChange={() => setMode(m)} />
              {scheduleModeLabel(m)}
            </label>
          ))}
        </div>
      </div>

      {mode === "halbtags" && (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Tageshälfte</span>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="halfDaySlot"
                value="vormittag"
                checked={halfDaySlot === "vormittag"}
                onChange={() => setHalfDaySlot("vormittag")}
              />
              Vormittag
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="halfDaySlot"
                value="nachmittag"
                checked={halfDaySlot === "nachmittag"}
                onChange={() => setHalfDaySlot("nachmittag")}
              />
              Nachmittag
            </label>
          </div>
        </div>
      )}

      {mode === "uhrzeit" ? (
        <div className="flex flex-wrap gap-4">
          <Field label="Start" htmlFor="startLocal">
            <Input
              id="startLocal"
              type="datetime-local"
              value={startLocal}
              onChange={(e) => setStartLocal(e.target.value)}
            />
          </Field>
          <Field label="Ende" htmlFor="endLocal">
            <Input
              id="endLocal"
              type="datetime-local"
              value={endLocal}
              onChange={(e) => setEndLocal(e.target.value)}
            />
          </Field>
        </div>
      ) : (
        <Field label="Datum" htmlFor="dateStr">
          <Input id="dateStr" type="date" value={dateStr} onChange={(e) => setDateStr(e.target.value)} />
        </Field>
      )}

      <Field label="Notiz (optional)" htmlFor="note">
        <Textarea id="note" name="note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>

      <FormMessage error={state.error} />
      {state.blocked && (
        <div className="flex flex-col gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <p>{state.blocked}</p>
          {/* Natives <button> mit eigenem name/value statt React-State - siehe
              MS 6: der Browser haengt confirmAbsenceOverride=true nur an, wenn
              genau dieser Klick den Submit ausgeloest hat. */}
          <button
            type="submit"
            name="confirmAbsenceOverride"
            value="true"
            className="w-fit rounded-lg border border-border bg-background px-2.5 py-1 text-[0.8rem] font-medium hover:bg-muted"
          >
            Trotzdem einplanen
          </button>
        </div>
      )}
      {state.warning && (
        <div className="flex flex-col gap-2 rounded-md bg-warning/10 px-3 py-2 text-sm text-warning-foreground">
          <p>{state.warning}</p>
          <button
            type="submit"
            name="confirmOverlap"
            value="true"
            className="w-fit rounded-lg border border-border bg-background px-2.5 py-1 text-[0.8rem] font-medium hover:bg-muted"
          >
            Trotzdem speichern
          </button>
        </div>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={pending} className="w-fit">
          {pending ? "Wird gespeichert…" : submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} className="w-fit">
            Abbrechen
          </Button>
        )}
      </div>
    </form>
  );
}
