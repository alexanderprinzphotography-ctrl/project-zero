import { readableForeground } from "./contrast";

export type BrandColors = {
  primaryColor: string | null;
  accentColor: string | null;
};

/**
 * CSS-Custom-Properties fuer Markenfarben. Werden identisch in hellem und
 * dunklem Modus angewendet (Wiedererkennung) - nur die neutrale Palette
 * (Hintergrund/Text/Ränder) unterscheidet sich per .dark-Klasse.
 */
export function brandCssVars({ primaryColor, accentColor }: BrandColors): Record<string, string> {
  const vars: Record<string, string> = {};

  if (primaryColor) {
    vars["--primary"] = primaryColor;
    vars["--primary-foreground"] = readableForeground(primaryColor);
  }
  if (accentColor) {
    vars["--accent"] = accentColor;
    vars["--accent-foreground"] = readableForeground(accentColor);
  }

  return vars;
}
