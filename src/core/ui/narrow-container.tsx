import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Zentrierte, lesbare Breite fuer Formulare & Detailseiten - Gegenstueck zu den ungewrappten, vollen 1400px-Listen/Planungsseiten (MS 10d). */
export function NarrowContainer({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-3xl", className)}>{children}</div>;
}
