"use client";

import { useActionState, useId, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { contactDisplayName } from "@/core/crm/contact";
import { createAiQuoteDraft, type AiDraftActionState } from "./ai-actions";
import type { CustomerOption, ProjectOption } from "./quote-header-form";

const fieldClass =
  "rounded-md border border-input bg-transparent px-3 py-2 text-base outline-none focus:ring-2 focus:ring-ring";
const smallFieldClass =
  "rounded-md border border-input bg-transparent px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring";

const INITIAL_STATE: AiDraftActionState = { error: null };

type RoomDraft = { name: string; length: string; width: string; height: string; count: string };

function emptyRoom(): RoomDraft {
  return { name: "", length: "", width: "", height: "", count: "1" };
}

function LoadingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex items-center gap-3 text-sm text-muted-foreground"
    >
      <motion.span
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
        className="inline-block h-4 w-4 rounded-full border-2 border-primary border-t-transparent"
      />
      KI erstellt den Entwurf – das kann einen Moment dauern…
    </motion.div>
  );
}

export function AiIntakeForm({
  customers,
  projects,
  defaultCustomerId,
  defaultProjectId,
}: {
  customers: CustomerOption[];
  projects: ProjectOption[];
  defaultCustomerId?: string;
  defaultProjectId?: string;
}) {
  const [state, formAction, pending] = useActionState(createAiQuoteDraft, INITIAL_STATE);
  const idPrefix = useId();

  const [customerId, setCustomerId] = useState(defaultCustomerId ?? "");
  const [projectId, setProjectId] = useState(defaultProjectId ?? "");
  const [description, setDescription] = useState("");
  const [rooms, setRooms] = useState<RoomDraft[]>([]);

  function updateRoom(index: number, field: keyof RoomDraft, value: string) {
    setRooms((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  }

  function removeRoom(index: number) {
    setRooms((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <form
      action={formAction}
      onReset={(e) => e.preventDefault()}
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="customerId" value={customerId} />
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="roomsJson" value={JSON.stringify(rooms)} readOnly />

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${idPrefix}-customer`} className="text-sm font-medium">
            Kunde
          </label>
          <select
            id={`${idPrefix}-customer`}
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            required
            className={fieldClass}
          >
            <option value="" disabled>
              Kunde wählen…
            </option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {contactDisplayName(c)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${idPrefix}-project`} className="text-sm font-medium">
            Projekt (optional)
          </label>
          <select
            id={`${idPrefix}-project`}
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className={fieldClass}
          >
            <option value="">Kein Projekt</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${idPrefix}-description`} className="text-sm font-medium">
          Beschreibung der Arbeiten
        </label>
        <textarea
          id={`${idPrefix}-description`}
          name="description"
          rows={5}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Was wurde vor Ort besprochen? Z. B. „Bad komplett neu fliesen, alte Fliesen entfernen, neue Sanitärobjekte montieren…“"
          required
          className={fieldClass}
        />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Räume/Maße (optional)</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setRooms((prev) => [...prev, emptyRoom()])}
          >
            + Raum hinzufügen
          </Button>
        </div>
        {rooms.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Ohne Räume funktioniert der Entwurf genauso, nur anhand der Beschreibung.
          </p>
        )}
        {rooms.map((room, index) => (
          <div key={index} className="grid grid-cols-6 items-end gap-2 rounded-md border border-border p-2">
            <div className="col-span-2 flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Raum</label>
              <input
                value={room.name}
                onChange={(e) => updateRoom(index, "name", e.target.value)}
                placeholder="Bad, Küche…"
                className={smallFieldClass}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Länge (m)</label>
              <input
                value={room.length}
                onChange={(e) => updateRoom(index, "length", e.target.value)}
                placeholder="4,0"
                className={smallFieldClass}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Breite (m)</label>
              <input
                value={room.width}
                onChange={(e) => updateRoom(index, "width", e.target.value)}
                placeholder="3,0"
                className={smallFieldClass}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Höhe (m)</label>
              <input
                value={room.height}
                onChange={(e) => updateRoom(index, "height", e.target.value)}
                placeholder="2,5"
                className={smallFieldClass}
              />
            </div>
            <div className="flex items-end gap-2">
              <div className="flex flex-1 flex-col gap-1">
                <label className="text-xs text-muted-foreground">Anzahl</label>
                <input
                  value={room.count}
                  onChange={(e) => updateRoom(index, "count", e.target.value)}
                  className={smallFieldClass}
                />
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => removeRoom(index)}>
                ✕
              </Button>
            </div>
          </div>
        ))}
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <div className="flex flex-col gap-2">
        <Button type="submit" disabled={pending} className="w-fit">
          {pending ? "Entwurf wird erstellt…" : "Entwurf erzeugen"}
        </Button>
        <AnimatePresence>{pending && <LoadingIndicator />}</AnimatePresence>
      </div>
    </form>
  );
}
