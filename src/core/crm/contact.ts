export type ContactType = "privat" | "gewerblich";

export type Contact = {
  id: string;
  customer_number: number;
  type: ContactType;
  company_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  street: string | null;
  postal_code: string | null;
  city: string | null;
  country: string;
  vat_id: string | null;
  notes: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
};

/**
 * Anzeigename: Firmenname bei gewerblich (falls gesetzt), sonst Vor-/Nachname,
 * mit Fallback auf den jeweils anderen Namensteil - deckt "mindestens ein
 * Name gesetzt" in beliebiger Kombination ab.
 */
export function contactDisplayName(
  contact: Pick<Contact, "type" | "company_name" | "first_name" | "last_name">,
): string {
  const personName = [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim();

  if (contact.type === "gewerblich" && contact.company_name?.trim()) {
    return contact.company_name.trim();
  }
  if (personName) return personName;
  return contact.company_name?.trim() || "–";
}

export function contactTypeLabel(type: ContactType): string {
  return type === "gewerblich" ? "Gewerblich" : "Privat";
}
