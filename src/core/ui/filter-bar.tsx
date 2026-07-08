import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Einheitlicher Wrapper fuer Such-/Filterleisten auf Listenseiten. */
export function FilterBar({ children, className, ...props }: React.ComponentProps<"form">) {
  return (
    <form {...props} className={cn("flex flex-wrap items-end gap-3", className)}>
      {children}
    </form>
  );
}

export function FilterField({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}
