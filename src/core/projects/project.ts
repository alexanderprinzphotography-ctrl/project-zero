export type ProjectStatus = "geplant" | "aktiv" | "pausiert" | "abgeschlossen";

export const PROJECT_STATUSES: ProjectStatus[] = ["geplant", "aktiv", "pausiert", "abgeschlossen"];

export type Project = {
  id: string;
  project_number: number;
  type: string;
  title: string;
  customer_id: string | null;
  status: ProjectStatus;
  description: string | null;
  site_street: string | null;
  site_postal_code: string | null;
  site_city: string | null;
  site_country: string;
  start_date: string | null;
  planned_end_date: string | null;
  metadata: Record<string, unknown>;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
};

export function projectStatusLabel(status: ProjectStatus): string {
  switch (status) {
    case "geplant":
      return "Geplant";
    case "aktiv":
      return "Aktiv";
    case "pausiert":
      return "Pausiert";
    case "abgeschlossen":
      return "Abgeschlossen";
  }
}
