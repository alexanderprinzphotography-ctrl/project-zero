"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/** Sichtbar-gesperrter Zustand fuer Nicht-Pro-Firmen - bewusst nicht versteckt (siehe MS 9b). Klick zeigt einen Upgrade-Hinweis statt direkt wegzunavigieren. */
export function AiLockedButton() {
  const [showHint, setShowHint] = useState(false);

  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setShowHint((v) => !v)}
        className="w-fit gap-1.5"
      >
        <span aria-hidden>🔒</span> Angebot mit KI erstellen
        <Badge variant="primary" className="text-[0.65rem]">
          Pro
        </Badge>
      </Button>
      {showHint && (
        <div className="flex flex-col gap-2 rounded-md bg-muted px-3 py-2 text-xs">
          <p>KI-Angebote sind Teil des Pro-Plans (im laufenden Test voll verfügbar).</p>
          <Link href="/konto/upgrade">
            <Button type="button" size="sm" className="w-fit">
              Jetzt upgraden
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
