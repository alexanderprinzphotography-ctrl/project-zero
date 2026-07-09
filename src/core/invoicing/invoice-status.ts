import type { BadgeVariant } from "@/components/ui/badge";
import type { MirroredInvoiceStatus } from "./provider";

export function invoiceStatusLabel(status: MirroredInvoiceStatus): string {
  switch (status) {
    case "entwurf":
      return "Entwurf";
    case "offen":
      return "Offen";
    case "teilbezahlt":
      return "Teilbezahlt";
    case "bezahlt":
      return "Bezahlt";
    case "storniert":
      return "Storniert";
  }
}

export function invoiceStatusVariant(status: MirroredInvoiceStatus): BadgeVariant {
  switch (status) {
    case "entwurf":
      return "default";
    case "offen":
      return "info";
    case "teilbezahlt":
      return "warning";
    case "bezahlt":
      return "success";
    case "storniert":
      return "destructive";
  }
}
