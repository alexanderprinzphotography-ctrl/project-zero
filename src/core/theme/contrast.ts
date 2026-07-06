const NEAR_WHITE = "#fafafa";
const NEAR_BLACK = "#171717";

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!match) return null;
  const int = parseInt(match[1], 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

function channelLuminance(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function relativeLuminance({ r, g, b }: { r: number; g: number; b: number }): number {
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

function contrastRatio(luminanceA: number, luminanceB: number): number {
  const lighter = Math.max(luminanceA, luminanceB);
  const darker = Math.min(luminanceA, luminanceB);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Liefert eine gut lesbare Vordergrundfarbe (nahezu Schwarz/Weiss) fuer den
 * gegebenen Hintergrund-Hex - per WCAG-Kontrastverhaeltnis, nicht per naivem
 * Luminanz-Schwellwert (0.5 waere z. B. bei Amber/Gelb falsch: dort gewinnt
 * Schwarz trotz mittlerer Luminanz klar gegen Weiss).
 */
export function readableForeground(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return NEAR_BLACK;

  const backgroundLuminance = relativeLuminance(rgb);
  const contrastWithWhite = contrastRatio(backgroundLuminance, 1);
  const contrastWithBlack = contrastRatio(backgroundLuminance, 0);

  return contrastWithWhite >= contrastWithBlack ? NEAR_WHITE : NEAR_BLACK;
}
