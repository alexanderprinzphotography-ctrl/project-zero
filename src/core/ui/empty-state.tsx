import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/** Gestalteter leerer Zustand (Symbol + ein Satz + primaere Aktion) statt einer leeren Flaeche - einheitlich fuer jede Liste im Produkt. */
export function EmptyState({
  icon: Icon,
  title,
  action,
}: {
  icon: LucideIcon;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border py-12 text-center">
      <Icon className="size-8 text-muted-foreground" strokeWidth={1.5} />
      <p className="text-sm text-muted-foreground">{title}</p>
      {action}
    </div>
  );
}
