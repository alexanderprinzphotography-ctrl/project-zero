"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { toBerlinDateTimeLocalValue, type TimeEntry } from "@/core/time/entry";
import { type TimeActionState } from "./actions";

const fieldClass =
  "rounded-md border border-input bg-transparent px-3 py-2 text-base outline-none focus:ring-2 focus:ring-ring";

export type ProjectOption = { id: string; label: string };
export type UserOption = { id: string; label: string };

// Kontrolliert (nicht defaultValue/uncontrolled): React 19 setzt Formulare nach
// JEDEM Server-Action-Aufruf automatisch zurueck, auch wenn die Action nur eine
// Warnung liefert (kein echter Erfolg) - bei unkontrollierten Feldern waeren
// Nutzereingaben genau in dem Moment verloren, in dem die Ueberlappungs-Warnung
// erscheint und "Trotzdem speichern" eigentlich nur die vorhandenen Werte
// bestaetigen soll.
function LocalDateTimeField({
  name,
  label,
  value,
  onChange,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (localValue: string) => void;
}) {
  const isoValue = value ? new Date(value).toISOString() : "";

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium">{label}</label>
      <input
        type="datetime-local"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={fieldClass}
      />
      {/* Umwandlung lokal (Europe/Berlin, Browser-Zeitzone) -> UTC-ISO passiert
          hier im Browser, nicht auf dem Server (der oft in UTC laeuft) - sonst
          waeren Dauer-Berechnungen ueber Zeitumstellungen hinweg falsch. */}
      <input type="hidden" name={name} value={isoValue} readOnly />
    </div>
  );
}

export function TimeEntryForm({
  entry,
  projectOptions,
  userOptions,
  defaultProjectId,
  action,
  onCancel,
  onSuccess,
  submitLabel,
}: {
  entry?: TimeEntry;
  projectOptions: ProjectOption[];
  userOptions: UserOption[];
  defaultProjectId?: string;
  action: (prevState: TimeActionState, formData: FormData) => Promise<TimeActionState>;
  onCancel?: () => void;
  onSuccess?: () => void;
  submitLabel: string;
}) {
  const initialState: TimeActionState = { error: null, warning: null, successAt: null };
  const [state, formAction, pending] = useActionState(action, initialState);

  const [projectId, setProjectId] = useState(entry?.project_id ?? defaultProjectId ?? "");
  const [userId, setUserId] = useState(entry?.user_id ?? "");
  const [startedAtLocal, setStartedAtLocal] = useState(
    entry?.started_at ? toBerlinDateTimeLocalValue(entry.started_at) : "",
  );
  const [endedAtLocal, setEndedAtLocal] = useState(
    entry?.ended_at ? toBerlinDateTimeLocalValue(entry.ended_at) : "",
  );
  const [breakMinutesStr, setBreakMinutesStr] = useState(String(entry?.break_minutes ?? 0));
  const [note, setNote] = useState(entry?.note ?? "");

  useEffect(() => {
    if (state.successAt) {
      onSuccess?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.successAt]);

  return (
    <form
      action={formAction}
      // React setzt das Formular nach jedem Action-Aufruf nativ zurueck (auch
      // bei einer reinen Ueberlappungs-Warnung statt echtem Erfolg). Bei
      // <select> greift dieser native Reset auf DOM-Ebene durch, obwohl das
      // Feld React-kontrolliert ist - sonst koennte "Trotzdem speichern" nach
      // der Warnung den falschen Mitarbeiter/das falsche Projekt speichern.
      onReset={(e) => e.preventDefault()}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="projectId" className="text-sm font-medium">
          Projekt
        </label>
        <select
          id="projectId"
          name="projectId"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          required
          className={fieldClass}
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
      </div>

      {userOptions.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="userId" className="text-sm font-medium">
            Mitarbeiter
          </label>
          <select
            id="userId"
            name="userId"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className={fieldClass}
          >
            <option value="">Ich selbst</option>
            {userOptions.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-wrap gap-4">
        <LocalDateTimeField
          name="startedAt"
          label="Start"
          value={startedAtLocal}
          onChange={setStartedAtLocal}
        />
        <LocalDateTimeField
          name="endedAt"
          label="Ende"
          value={endedAtLocal}
          onChange={setEndedAtLocal}
        />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="breakMinutes" className="text-sm font-medium">
            Pause (Minuten)
          </label>
          <input
            id="breakMinutes"
            name="breakMinutes"
            type="number"
            min={0}
            value={breakMinutesStr}
            onChange={(e) => setBreakMinutesStr(e.target.value)}
            className={`${fieldClass} w-28`}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="note" className="text-sm font-medium">
          Notiz (optional)
        </label>
        <textarea
          id="note"
          name="note"
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className={fieldClass}
        />
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.warning && (
        <div className="flex flex-col gap-2 rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
          <p>{state.warning}</p>
          {/* Bewusst ein natives <button> (nicht die Button-Komponente, die
              @base-ui/react wrapped): der Browser haengt "confirmOverlap=true"
              nur an, wenn genau DIESER Button den Submit ausgeloest hat - kein
              Risiko, dass ein React-State-Update das Formular-Absenden nicht
              rechtzeitig einholt. */}
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
