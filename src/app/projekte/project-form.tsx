"use client";

import { useActionState, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { DynamicFieldsSection } from "@/core/ui/dynamic-fields-section";
import { PROJECT_STATUSES, projectStatusLabel, type Project } from "@/core/projects/project";
import type { ProjectFieldConfig } from "@/core/projects/dynamic-fields";
import type { ProjectActionState } from "./actions";

const fieldClass =
  "rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

export type CustomerOption = {
  id: string;
  label: string;
  street: string | null;
  postal_code: string | null;
  city: string | null;
  country: string;
};

const initialState: ProjectActionState = { error: null };

export function ProjectForm({
  project,
  customers,
  handwerkFields,
  action,
  submitLabel,
}: {
  project?: Project;
  customers: CustomerOption[];
  handwerkFields: ProjectFieldConfig[];
  action: (prevState: ProjectActionState, formData: FormData) => Promise<ProjectActionState>;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [customerId, setCustomerId] = useState(project?.customer_id ?? "");

  const streetRef = useRef<HTMLInputElement>(null);
  const postalRef = useRef<HTMLInputElement>(null);
  const cityRef = useRef<HTMLInputElement>(null);
  const countryRef = useRef<HTMLInputElement>(null);

  function copyFromCustomer() {
    const customer = customers.find((c) => c.id === customerId);
    if (!customer) return;
    if (streetRef.current) streetRef.current.value = customer.street ?? "";
    if (postalRef.current) postalRef.current.value = customer.postal_code ?? "";
    if (cityRef.current) cityRef.current.value = customer.city ?? "";
    if (countryRef.current) countryRef.current.value = customer.country || "DE";
  }

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="title" className="text-sm font-medium">
          Titel
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          defaultValue={project?.title ?? ""}
          className={fieldClass}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="customerId" className="text-sm font-medium">
          Kunde
        </label>
        <select
          id="customerId"
          name="customerId"
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          className={fieldClass}
        >
          <option value="">Kein Kunde</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="status" className="text-sm font-medium">
          Status
        </label>
        <select
          id="status"
          name="status"
          defaultValue={project?.status ?? "geplant"}
          className={fieldClass}
        >
          {PROJECT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {projectStatusLabel(s)}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Baustellenadresse</label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={copyFromCustomer}
            disabled={!customerId}
          >
            Aus Kundenadresse übernehmen
          </Button>
        </div>
        <input
          ref={streetRef}
          name="siteStreet"
          type="text"
          placeholder="Straße & Hausnummer"
          defaultValue={project?.site_street ?? ""}
          className={fieldClass}
        />
        <div className="flex gap-4">
          <input
            ref={postalRef}
            name="sitePostalCode"
            type="text"
            placeholder="PLZ"
            defaultValue={project?.site_postal_code ?? ""}
            className={`${fieldClass} w-32`}
          />
          <input
            ref={cityRef}
            name="siteCity"
            type="text"
            placeholder="Ort"
            defaultValue={project?.site_city ?? ""}
            className={`${fieldClass} flex-1`}
          />
          <input
            ref={countryRef}
            name="siteCountry"
            type="text"
            placeholder="Land"
            defaultValue={project?.site_country ?? "DE"}
            className={`${fieldClass} w-24`}
          />
        </div>
      </div>

      <div className="flex gap-4">
        <div className="flex flex-1 flex-col gap-1.5">
          <label htmlFor="startDate" className="text-sm font-medium">
            Start
          </label>
          <input
            id="startDate"
            name="startDate"
            type="date"
            defaultValue={project?.start_date ?? ""}
            className={fieldClass}
          />
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <label htmlFor="plannedEndDate" className="text-sm font-medium">
            Geplantes Ende
          </label>
          <input
            id="plannedEndDate"
            name="plannedEndDate"
            type="date"
            defaultValue={project?.planned_end_date ?? ""}
            className={fieldClass}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="description" className="text-sm font-medium">
          Beschreibung
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={project?.description ?? ""}
          className={fieldClass}
        />
      </div>

      <DynamicFieldsSection fields={handwerkFields} values={project?.metadata ?? {}} />

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Wird gespeichert…" : submitLabel}
      </Button>
    </form>
  );
}
