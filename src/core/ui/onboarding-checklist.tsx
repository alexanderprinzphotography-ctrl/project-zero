"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const DISMISS_KEY = "bz-onboarding-dismissed";

export type OnboardingItem = { key: string; label: string; done: boolean; href: string };

/** Dezente, ausblendbare Erst-Onboarding-Checkliste - Ausblenden ist rein kosmetisch (localStorage), keine Server-Persistenz noetig. */
export function OnboardingChecklist({ items }: { items: OnboardingItem[] }) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // localStorage existiert serverseitig nicht - bewusst erst nach dem Mount
    // lesen (sonst Hydration-Mismatch), daher zwangslaeufig ein setState im
    // Effect statt eines lazy useState-Initializers.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDismissed(window.localStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  const allDone = items.every((item) => item.done);
  if (dismissed || allDone) return null;

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle>Erste Schritte</CardTitle>
        <CardAction>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              window.localStorage.setItem(DISMISS_KEY, "1");
              setDismissed(true);
            }}
          >
            Ausblenden
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-2.5">
          {items.map((item) => (
            <li key={item.key} className="flex items-center gap-2.5 text-sm">
              {item.done ? (
                <CheckCircle2 className="size-4 shrink-0 text-success-foreground" />
              ) : (
                <Circle className="size-4 shrink-0 text-muted-foreground" />
              )}
              {item.done ? (
                <span className="text-muted-foreground line-through">{item.label}</span>
              ) : (
                <Link href={item.href} className="hover:underline">
                  {item.label}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
