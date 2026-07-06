import { createClient } from "@/core/supabase/server";
import { contactDisplayName } from "@/core/crm/contact";
import type { CustomerOption } from "./project-form";

export async function getCustomerOptions(): Promise<CustomerOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("contacts")
    .select("id, type, company_name, first_name, last_name, street, postal_code, city, country")
    .eq("is_archived", false)
    .order("customer_number", { ascending: true });

  return (data ?? []).map((c) => ({
    id: c.id,
    label: contactDisplayName(c),
    street: c.street,
    postal_code: c.postal_code,
    city: c.city,
    country: c.country,
  }));
}
