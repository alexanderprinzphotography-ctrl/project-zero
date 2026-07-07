"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { contactDisplayName } from "@/core/crm/contact";
import type { Quote } from "@/core/quotes/quote";
import { type QuoteActionState } from "./actions";

const fieldClass =
  "rounded-md border border-input bg-transparent px-3 py-2 text-base outline-none focus:ring-2 focus:ring-ring";

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
    <form
      action={formAction}
      // Siehe MS 6/7: React setzt Formulare nach jedem Action-Aufruf (auch bei
      // reinem Validierungsfehler) nativ zurueck - bei <select> schlaegt das
      // trotz React-Kontrolle auf DOM-Ebene durch.
      onReset={(e) => e.preventDefault()}
      className="flex flex-col gap-4"
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="customerId" className="text-sm font-medium">
            Kunde
          </label>
          <select
            id="customerId"
            name="customerId"
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
          <label htmlFor="projectId" className="text-sm font-medium">
            Projekt (optional)
          </label>
          <select
            id="projectId"
            name="projectId"
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
        <div className="flex flex-col gap-1.5">
          <label htmlFor="quoteDate" className="text-sm font-medium">
            Angebotsdatum
          </label>
          <input
            id="quoteDate"
            name="quoteDate"
            type="date"
            value={quoteDate}
            onChange={(e) => setQuoteDate(e.target.value)}
            required
            className={fieldClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="validUntil" className="text-sm font-medium">
            Gültig bis
          </label>
          <input
            id="validUntil"
            name="validUntil"
            type="date"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
            required
            className={fieldClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="taxRate" className="text-sm font-medium">
            Steuersatz (%)
          </label>
          <input
            id="taxRate"
            name="taxRate"
            type="number"
            min={0}
            value={taxRate}
            onChange={(e) => setTaxRate(e.target.value)}
            required
            className={fieldClass}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="introText" className="text-sm font-medium">
          Anschreiben – Einleitung (optional)
        </label>
        <textarea
          id="introText"
          name="introText"
          rows={3}
          value={introText}
          onChange={(e) => setIntroText(e.target.value)}
          className={fieldClass}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="closingText" className="text-sm font-medium">
          Anschreiben – Schluss (optional)
        </label>
        <textarea
          id="closingText"
          name="closingText"
          rows={3}
          value={closingText}
          onChange={(e) => setClosingText(e.target.value)}
          className={fieldClass}
        />
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

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
