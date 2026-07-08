"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/core/ui/field";
import { FormMessage } from "@/core/ui/form-message";
import { contactDisplayName } from "@/core/crm/contact";
import type { Quote } from "@/core/quotes/quote";
import { type QuoteActionState } from "./actions";

const selectClass = "h-10 rounded-md border border-input bg-transparent px-3 text-sm";

export type CustomerOption = {
  id: string;
  type: "privat" | "gewerblich";
  company_name: string | null;
  first_name: string | null;
  last_name: string | null;
};

export type ProjectOption = { id: string; title: string };

function todayDateString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function daysFromNowDateString(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function QuoteHeaderForm({
  quote,
  defaultCustomerId,
  defaultProjectId,
  customers,
  projects,
  action,
  onCancel,
  submitLabel,
}: {
  quote?: Quote;
  defaultCustomerId?: string;
  defaultProjectId?: string;
  customers: CustomerOption[];
  projects: ProjectOption[];
  action: (prevState: QuoteActionState, formData: FormData) => Promise<QuoteActionState>;
  onCancel?: () => void;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, { error: null });

  const [customerId, setCustomerId] = useState(quote?.customer_id ?? defaultCustomerId ?? "");
  const [projectId, setProjectId] = useState(quote?.project_id ?? defaultProjectId ?? "");
  const [quoteDate, setQuoteDate] = useState(quote?.quote_date ?? todayDateString());
  const [validUntil, setValidUntil] = useState(quote?.valid_until ?? daysFromNowDateString(30));
  const [taxRate, setTaxRate] = useState(String(quote?.tax_rate ?? 19));
  const [introText, setIntroText] = useState(quote?.intro_text ?? "");
  const [closingText, setClosingText] = useState(quote?.closing_text ?? "");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Angebotsdaten</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          action={formAction}
          // Siehe MS 6/7: React setzt Formulare nach jedem Action-Aufruf (auch bei
          // reinem Validierungsfehler) nativ zurueck - bei <select> schlaegt das
          // trotz React-Kontrolle auf DOM-Ebene durch.
          onReset={(e) => e.preventDefault()}
          className="flex flex-col gap-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <Field label="Kunde" htmlFor="customerId">
              <select
                id="customerId"
                name="customerId"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                required
                className={selectClass}
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
            </Field>
            <Field label="Projekt (optional)" htmlFor="projectId">
              <select
                id="projectId"
                name="projectId"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className={selectClass}
              >
                <option value="">Kein Projekt</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Angebotsdatum" htmlFor="quoteDate">
              <Input
                id="quoteDate"
                name="quoteDate"
                type="date"
                value={quoteDate}
                onChange={(e) => setQuoteDate(e.target.value)}
                required
              />
            </Field>
            <Field label="Gültig bis" htmlFor="validUntil">
              <Input
                id="validUntil"
                name="validUntil"
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                required
              />
            </Field>
            <Field label="Steuersatz (%)" htmlFor="taxRate">
              <Input
                id="taxRate"
                name="taxRate"
                type="number"
                min={0}
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
                required
              />
            </Field>
          </div>

          <Field label="Anschreiben – Einleitung (optional)" htmlFor="introText">
            <Textarea
              id="introText"
              name="introText"
              rows={3}
              value={introText}
              onChange={(e) => setIntroText(e.target.value)}
            />
          </Field>
          <Field label="Anschreiben – Schluss (optional)" htmlFor="closingText">
            <Textarea
              id="closingText"
              name="closingText"
              rows={3}
              value={closingText}
              onChange={(e) => setClosingText(e.target.value)}
            />
          </Field>

          <FormMessage error={state.error} />

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
      </CardContent>
    </Card>
  );
}
