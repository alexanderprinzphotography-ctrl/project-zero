import type { ProjectFieldConfig } from "@/core/projects/dynamic-fields";

/**
 * Baustellenspezifische Zusatzfelder fuer Handwerksbetriebe. Werte landen in
 * projects.metadata (nicht als feste Spalten) - ein spaeterer Makler-Typ
 * bekommt einfach eine andere Konfiguration, ohne den Core anzufassen.
 */
export const handwerkProjectFields: ProjectFieldConfig[] = [
  { key: "site_contact_name", label: "Ansprechpartner vor Ort", type: "text" },
  { key: "site_contact_phone", label: "Telefon vor Ort", type: "text" },
  { key: "access_notes", label: "Zufahrt-/Zugangshinweise", type: "textarea" },
];
