"use client";

import { useActionState, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/core/ui/field";
import { FormMessage } from "@/core/ui/form-message";
import { DynamicFieldsSection } from "@/core/ui/dynamic-fields-section";
import { PROJECT_STATUSES, projectStatusLabel, type Project } from "@/core/projects/project";
import type { ProjectFieldConfig } from "@/core/projects/dynamic-fields";
import type { ProjectActionState } from "./actions";

const selectClass = "h-10 rounded-md border border-input bg-transparent px-3 text-sm";

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
    <Card>
      <CardHeader>
        <CardTitle>Projektdaten</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          <Field label="Titel" htmlFor="title">
            <Input id="title" name="title" type="text" required defaultValue={project?.title ?? ""} />
          </Field>

          <Field label="Kunde" htmlFor="customerId">
            <select
              id="customerId"
              name="customerId"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className={selectClass}
            >
              <option value="">Kein Kunde</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Status" htmlFor="status">
            <select id="status" name="status" defaultValue={project?.status ?? "geplant"} className={selectClass}>
              {PROJECT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {projectStatusLabel(s)}
                </option>
              ))}
            </select>
          </Field>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Baustellenadresse</span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={copyFromCustomer}
                disabled={!customerId}
              >
                Aus Kundenadresse übernehmen
              </Button>
            </div>
            <Input
              ref={streetRef}
              name="siteStreet"
              type="text"
              placeholder="Straße & Hausnummer"
              defaultValue={project?.site_street ?? ""}
            />
            <div className="flex gap-4">
              <Input
                ref={postalRef}
                name="sitePostalCode"
                type="text"
                placeholder="PLZ"
                defaultValue={project?.site_postal_code ?? ""}
                className="w-32"
              />
              <Input
                ref={cityRef}
                name="siteCity"
                type="text"
                placeholder="Ort"
                defaultValue={project?.site_city ?? ""}
                className="flex-1"
              />
              <Input
                ref={countryRef}
                name="siteCountry"
                type="text"
                placeholder="Land"
                defaultValue={project?.site_country ?? "DE"}
                className="w-24"
              />
            </div>
          </div>

          <div className="flex gap-4">
            <Field className="flex-1" label="Start" htmlFor="startDate">
              <Input id="startDate" name="startDate" type="date" defaultValue={project?.start_date ?? ""} />
            </Field>
            <Field className="flex-1" label="Geplantes Ende" htmlFor="plannedEndDate">
              <Input
                id="plannedEndDate"
                name="plannedEndDate"
                type="date"
                defaultValue={project?.planned_end_date ?? ""}
              />
            </Field>
          </div>

          <Field label="Beschreibung" htmlFor="description">
            <Textarea id="description" name="description" rows={3} defaultValue={project?.description ?? ""} />
          </Field>

          <DynamicFieldsSection fields={handwerkFields} values={project?.metadata ?? {}} />

          <FormMessage error={state.error} />

          <Button type="submit" disabled={pending} className="w-fit">
            {pending ? "Wird gespeichert…" : submitLabel}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
