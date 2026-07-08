"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/core/ui/field";
import { FormMessage } from "@/core/ui/form-message";
import type { Contact, ContactType } from "@/core/crm/contact";
import type { ContactActionState } from "./actions";

const initialState: ContactActionState = { error: null };

export function ContactForm({
  contact,
  action,
  submitLabel,
}: {
  contact?: Contact;
  action: (prevState: ContactActionState, formData: FormData) => Promise<ContactActionState>;
  submitLabel: string;
}) {
  const [type, setType] = useState<ContactType>(contact?.type ?? "privat");
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Typ</label>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="type"
              value="privat"
              checked={type === "privat"}
              onChange={() => setType("privat")}
            />
            Privat
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="type"
              value="gewerblich"
              checked={type === "gewerblich"}
              onChange={() => setType("gewerblich")}
            />
            Gewerblich
          </label>
        </div>
      </div>

      {type === "gewerblich" && (
        <Field label="Firmenname" htmlFor="companyName">
          <Input id="companyName" name="companyName" type="text" defaultValue={contact?.company_name ?? ""} />
        </Field>
      )}

      <div className="flex gap-4">
        <Field
          className="flex-1"
          label={type === "gewerblich" ? "Ansprechpartner Vorname" : "Vorname"}
          htmlFor="firstName"
        >
          <Input id="firstName" name="firstName" type="text" defaultValue={contact?.first_name ?? ""} />
        </Field>
        <Field
          className="flex-1"
          label={type === "gewerblich" ? "Ansprechpartner Nachname" : "Nachname"}
          htmlFor="lastName"
        >
          <Input id="lastName" name="lastName" type="text" defaultValue={contact?.last_name ?? ""} />
        </Field>
      </div>

      <div className="flex gap-4">
        <Field className="flex-1" label="E-Mail" htmlFor="email">
          <Input id="email" name="email" type="email" defaultValue={contact?.email ?? ""} />
        </Field>
        <Field className="flex-1" label="Telefon" htmlFor="phone">
          <Input id="phone" name="phone" type="text" defaultValue={contact?.phone ?? ""} />
        </Field>
        <Field className="flex-1" label="Mobil" htmlFor="mobile">
          <Input id="mobile" name="mobile" type="text" defaultValue={contact?.mobile ?? ""} />
        </Field>
      </div>

      <Field label="Straße & Hausnummer" htmlFor="street">
        <Input id="street" name="street" type="text" defaultValue={contact?.street ?? ""} />
      </Field>

      <div className="flex gap-4">
        <Field className="w-32" label="PLZ" htmlFor="postalCode">
          <Input id="postalCode" name="postalCode" type="text" defaultValue={contact?.postal_code ?? ""} />
        </Field>
        <Field className="flex-1" label="Ort" htmlFor="city">
          <Input id="city" name="city" type="text" defaultValue={contact?.city ?? ""} />
        </Field>
        <Field className="w-24" label="Land" htmlFor="country">
          <Input id="country" name="country" type="text" defaultValue={contact?.country ?? "DE"} />
        </Field>
      </div>

      {type === "gewerblich" && (
        <Field label="USt-IdNr." htmlFor="vatId">
          <Input id="vatId" name="vatId" type="text" defaultValue={contact?.vat_id ?? ""} />
        </Field>
      )}

      <Field label="Notizen" htmlFor="notes">
        <Textarea id="notes" name="notes" rows={3} defaultValue={contact?.notes ?? ""} />
      </Field>

      <FormMessage error={state.error} />

      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Wird gespeichert…" : submitLabel}
      </Button>
    </form>
  );
}
