/**
 * Geldbeträge werden ausschließlich als Ganzzahl in Cent gespeichert/verarbeitet
 * - nie als Float. Umrechnung €<->Cent passiert NUR hier, an der Eingabe-/
 * Anzeige-Grenze, und ohne Dezimal-Multiplikation (die bei Floats zu
 * Rundungsdrift führen kann, z. B. 19.99 * 100 !== 1999 in manchen Faellen).
 */

const euroFormatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

/** Formatiert Cent als lokalisierten Euro-String, z. B. 1999 -> "19,99 €". */
export function formatCentsAsEuro(cents: number): string {
  return euroFormatter.format(cents / 100);
}

/**
 * Parst eine deutsche Eingabe ("19,99", "1999", "0,5") zu ganzen Cent.
 * Reine Integer-Arithmetik (Komma-Position statt Dezimal-Multiplikation) -
 * kein Float-Rundungsrisiko. Gibt null bei ungültiger Eingabe zurück.
 */
export function parseEuroInputToCents(input: string): number | null {
  const trimmed = input.trim();
  if (!/^\d+(,\d{1,2})?$/.test(trimmed)) return null;

  const [wholePart, fractionPart = ""] = trimmed.split(",");
  const paddedFraction = fractionPart.padEnd(2, "0");
  return Number(wholePart) * 100 + Number(paddedFraction);
}

/** Fürs Vorbefüllen von Bearbeiten-Formularen: Cent -> "19,99"-Eingabeformat. */
export function centsToEuroInputValue(cents: number): string {
  const wholePart = Math.trunc(cents / 100);
  const fractionPart = Math.abs(cents % 100)
    .toString()
    .padStart(2, "0");
  return `${wholePart},${fractionPart}`;
}
