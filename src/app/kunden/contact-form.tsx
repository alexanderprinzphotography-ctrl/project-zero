"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import type { Contact, ContactType } from "@/core/crm/contact";
import type { ContactActionState } from "./actions";

const fieldClass =
  "rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

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
        <div className="flex flex-col gap-1.5">
          <label htmlFor="companyName" className="text-sm font-medium">
            Firmenname
          </label>
          <input
            id="companyName"
            name="companyName"
            type="text"
            defaultValue={contact?.company_name ?? ""}
            className={fieldClass}
          />
        </div>
      )}

      <div className="flex gap-4">
        <div className="flex flex-1 flex-col gap-1.5">
          <label htmlFor="firstName" className="text-sm font-medium">
            {type === "gewerblich" ? "Ansprechpartner Vorname" : "Vorname"}
          </label>
          <input
            id="firstName"
            name="firstName"
            type="text"
            defaultValue={contact?.first_name ?? ""}
            className={fieldClass}
          />
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <label htmlFor="lastName" className="text-sm font-medium">
            {type === "gewerblich" ? "Ansprechpartner Nachname" : "Nachname"}
          </label>
          <input
            id="lastName"
            name="lastName"
            type="text"
            defaultValue={contact?.last_name ?? ""}
            className={fieldClass}
          />
        </div>
      </div>

      <div className="flex gap-4">
        <div className="flex flex-1 flex-col gap-1.5">
          <label htmlFor="email" className="text-sm font-medium">
            E-Mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            defaultValue={contact?.email ?? ""}
            className={fieldClass}
          />
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <label htmlFor="phone" className="text-sm font-medium">
            Telefon
          </label>
          <input
            id="phone"
            name="phone"
            type="text"
            defaultValue={contact?.phone ?? ""}
            className={fieldClass}
          />
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <label htmlFor="mobile" className="text-sm font-medium">
            Mobil
          </label>
          <input
            id="mobile"
            name="mobile"
            type="text"
            defaultValue={contact?.mobile ?? ""}
            className={fieldClass}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="street" className="text-sm font-medium">
          Straße &amp; Hausnummer
        </label>
        <input
          id="street"
          name="street"
          type="text"
          defaultValue={contact?.street ?? ""}
          className={fieldClass}
        />
      </div>

      <div className="flex gap-4">
        <div className="flex w-32 flex-col gap-1.5">
          <label htmlFor="postalCode" className="text-sm font-medium">
            PLZ
          </label>
          <input
            id="postalCode"
            name="postalCode"
            type="text"
            defaultValue={contact?.postal_code ?? ""}
            className={fieldClass}
          />
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <label htmlFor="city" className="text-sm font-medium">
            Ort
          </label>
          <input
            id="city"
            name="city"
            type="text"
            defaultValue={contact?.city ?? ""}
            className={fieldClass}
          />
        </div>
        <div className="flex w-24 flex-col gap-1.5">
          <label htmlFor="country" className="text-sm font-medium">
            Land
          </label>
          <input
            id="country"
            name="country"
            type="text"
            defaultValue={contact?.country ?? "DE"}
            className={fieldClass}
          />
        </div>
      </div>

      {type === "gewerblich" && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="vatId" className="text-sm font-medium">
            USt-IdNr.
          </label>
          <input
            id="vatId"
            name="vatId"
            type="text"
            defaultValue={contact?.vat_id ?? ""}
            className={fieldClass}
          />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="notes" className="text-sm font-medium">
          Notizen
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={contact?.notes ?? ""}
          className={fieldClass}
        />
      </div>

      {state.error && <p className="text-sm text-destructive">{state.error}</p>}

      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Wird gespeichert…" : submitLabel}
      </Button>
    </form>
  );
}
