"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { registerCompany, type RegisterActionState } from "./actions";

const initialState: RegisterActionState = { error: null, info: null };

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(registerCompany, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="companyName" className="text-sm font-medium">
          Firmenname
        </label>
        <input
          id="companyName"
          name="companyName"
          type="text"
          required
          className="rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="fullName" className="text-sm font-medium">
          Dein Name
        </label>
        <input
          id="fullName"
          name="fullName"
          type="text"
          required
          autoComplete="name"
          className="rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium">
          E-Mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium">
          Passwort
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.info && <p className="text-sm text-muted-foreground">{state.info}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Wird registriert…" : "Firma registrieren (14 Tage kostenlos testen)"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        Bereits registriert?{" "}
        <Link href="/login" className="hover:text-foreground">
          Anmelden
        </Link>
      </p>
    </form>
  );
}
