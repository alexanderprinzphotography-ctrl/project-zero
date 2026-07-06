"use client";

import { useActionState, useState, type CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { brandCssVars } from "@/core/theme/brand-style";
import { updateThemeColors, uploadLogo, type ThemeActionState } from "./actions";

const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const initialState: ThemeActionState = { error: null, success: false };

export function ThemeSettingsForm({
  initialPrimary,
  initialAccent,
  initialLogoUrl,
  readOnly,
}: {
  initialPrimary: string;
  initialAccent: string;
  initialLogoUrl: string | null;
  readOnly: boolean;
}) {
  const [primary, setPrimary] = useState(initialPrimary);
  const [accent, setAccent] = useState(initialAccent);
  const [logoPreview, setLogoPreview] = useState<string | null>(initialLogoUrl);

  const [colorState, colorAction, colorPending] = useActionState(updateThemeColors, initialState);
  const [logoState, logoAction, logoPending] = useActionState(uploadLogo, initialState);

  const previewVars = brandCssVars({
    primaryColor: HEX_RE.test(primary) ? primary : null,
    accentColor: HEX_RE.test(accent) ? accent : null,
  });

  return (
    <div className="flex flex-col gap-8">
      {readOnly && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Testphase abgelaufen – Theme-Einstellungen sind gesperrt.
        </p>
      )}

      <form action={colorAction} className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-6">
          <label className="flex flex-col gap-1 text-sm">
            Primärfarbe
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={HEX_RE.test(primary) ? primary : "#000000"}
                onChange={(e) => setPrimary(e.target.value)}
                disabled={readOnly}
                className="h-9 w-9 cursor-pointer rounded border border-input"
                aria-label="Primärfarbe (Farbwähler)"
              />
              <input
                type="text"
                name="primaryColor"
                value={primary}
                onChange={(e) => setPrimary(e.target.value)}
                disabled={readOnly}
                placeholder="#2563eb"
                className="w-28 rounded-md border border-input bg-transparent px-2 py-1.5 text-sm"
              />
            </div>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Akzentfarbe
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={HEX_RE.test(accent) ? accent : "#000000"}
                onChange={(e) => setAccent(e.target.value)}
                disabled={readOnly}
                className="h-9 w-9 cursor-pointer rounded border border-input"
                aria-label="Akzentfarbe (Farbwähler)"
              />
              <input
                type="text"
                name="accentColor"
                value={accent}
                onChange={(e) => setAccent(e.target.value)}
                disabled={readOnly}
                placeholder="#f59e0b"
                className="w-28 rounded-md border border-input bg-transparent px-2 py-1.5 text-sm"
              />
            </div>
          </label>
        </div>
        {colorState.error && <p className="text-sm text-destructive">{colorState.error}</p>}
        {colorState.success && <p className="text-sm text-muted-foreground">Gespeichert.</p>}
        <Button type="submit" disabled={readOnly || colorPending} className="w-fit">
          {colorPending ? "Wird gespeichert…" : "Farben speichern"}
        </Button>
      </form>

      <form action={logoAction} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          Logo (PNG, JPG, SVG oder WEBP, max. 2 MB)
          <input
            type="file"
            name="logo"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            disabled={readOnly}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) setLogoPreview(URL.createObjectURL(file));
            }}
            className="text-sm"
          />
        </label>
        {logoState.error && <p className="text-sm text-destructive">{logoState.error}</p>}
        {logoState.success && <p className="text-sm text-muted-foreground">Logo aktualisiert.</p>}
        <Button type="submit" disabled={readOnly || logoPending} className="w-fit">
          {logoPending ? "Wird hochgeladen…" : "Logo hochladen"}
        </Button>
      </form>

      <div>
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">Live-Vorschau</h2>
        <div
          style={previewVars as CSSProperties}
          className="flex flex-col gap-4 rounded-lg border border-border p-4"
        >
          <div className="flex items-center gap-2">
            {logoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element -- Vorschau aus Object-URL/externer Storage-URL
              <img
                src={logoPreview}
                alt="Logo-Vorschau"
                className="h-8 w-8 rounded object-contain"
              />
            ) : (
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-sm text-primary-foreground">
                BZ
              </span>
            )}
            <span className="font-semibold">Vorschau</span>
          </div>
          <div className="flex gap-2">
            <Button type="button" size="sm">
              Primär
            </Button>
            <Button
              type="button"
              size="sm"
              className="bg-accent text-accent-foreground hover:bg-accent"
            >
              Akzent
            </Button>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Beispiel-Card</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              So sehen Karten mit euren Farben aus.
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
