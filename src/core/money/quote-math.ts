/**
 * Positions- und Summen-Berechnung fuer Angebote - ausschliesslich exakte
 * Ganzzahl-Arithmetik (BigInt fuer Zwischenprodukte), nie Float, keine KI.
 *
 * quantity wird an der Eingabe-Grenze als "Hundertstel" (ganzzahlig, 2
 * Nachkommastellen) dargestellt, damit quantity * unit_price_net_cents immer
 * ein exaktes Ganzzahl-Produkt ist. Gerundet wird ausschliesslich kaufmaennisch
 * (halbe Cent aufrunden) und immer erst ganz am Ende einer Berechnung.
 */

const QUANTITY_INPUT_RE = /^\d+(,\d{1,2})?$/;

/** Parst eine deutsche Mengen-Eingabe ("12,5", "3") zu Hundertsteln. Reine Integer-Arithmetik, kein Float-Risiko. */
export function parseQuantityToHundredths(input: string): number | null {
  const trimmed = input.trim();
  if (!QUANTITY_INPUT_RE.test(trimmed)) return null;

  const [wholePart, fractionPart = ""] = trimmed.split(",");
  const paddedFraction = fractionPart.padEnd(2, "0");
  return Number(wholePart) * 100 + Number(paddedFraction);
}

/** Hundertstel -> deutsches Eingabeformat, z. B. 1250 -> "12,50". */
export function hundredthsToQuantityInputValue(hundredths: number): string {
  const wholePart = Math.trunc(hundredths / 100);
  const fractionPart = Math.abs(hundredths % 100)
    .toString()
    .padStart(2, "0");
  return `${wholePart},${fractionPart}`;
}

/** Hundertstel -> Dezimal-String fuers Speichern in einer numeric-Spalte (z. B. 1250 -> "12.50"). Kein Float involviert. */
export function hundredthsToDecimalString(hundredths: number): string {
  const wholePart = Math.trunc(hundredths / 100);
  const fractionPart = Math.abs(hundredths % 100)
    .toString()
    .padStart(2, "0");
  return `${wholePart}.${fractionPart}`;
}

/**
 * Dezimalzahl (z. B. von Postgres als JSON-Number geliefert) -> Hundertstel.
 * NUR fuers Vorbefuellen von Formularen bei bestehenden Positionen (Anzeige)
 * gedacht - nicht Teil der eigentlichen Summen-Berechnung, die ausschliesslich
 * beim Schreiben aus der frischen Nutzereingabe passiert (computeLineTotalNetCents).
 * Ein einzelnes Runden nach einem JSON-Rundtrip ist unkritisch, da der
 * Float-Fehler dabei um Groessenordnungen kleiner als die Rundungsschwelle ist.
 */
export function decimalNumberToHundredths(value: number): number {
  return Math.round(value * 100);
}

/** Kaufmaennische Rundung (halbe aufrunden) von numerator/denominator - reine BigInt-Ganzzahl-Arithmetik, kein Float. Nur fuer nicht-negative Werte gedacht (Mengen/Preise sind hier nie negativ). */
function roundHalfUpBigInt(numerator: bigint, denominator: bigint): bigint {
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  // BigInt-Literalsyntax (100n) braucht ES2020+; das Projekt zielt auf
  // ES2017 - daher BigInt(...) als Funktionsaufruf statt Literal.
  return remainder * BigInt(2) >= denominator ? quotient + BigInt(1) : quotient;
}

/**
 * quantity (Hundertstel) x unit_price_net_cents -> line_total_net_cents,
 * kaufmaennisch auf ganze Cent gerundet. Review-Checkpoint-Beispiel:
 * 12,5 x 19,99 € = 1250 x 1999 = 2498750 Cent-Hundertstel -> gerundet 24988
 * Cent (249,88 €), nicht 24987 oder 24989.
 */
export function computeLineTotalNetCents(quantityHundredths: number, unitPriceNetCents: number): number {
  const scaled = BigInt(quantityHundredths) * BigInt(unitPriceNetCents);
  return Number(roundHalfUpBigInt(scaled, BigInt(100)));
}

/** Summe bereits exakter Ganzzahl-Cent-Werte - reine Integer-Addition, kein Rundungsrisiko. */
export function computeNetTotalCents(lineTotalsNetCents: number[]): number {
  return lineTotalsNetCents.reduce((sum, cents) => sum + cents, 0);
}

/** net_total x tax_rate / 100, kaufmaennisch gerundet. Exakte BigInt-Ganzzahl-Arithmetik. */
export function computeTaxTotalCents(netTotalCents: number, taxRatePercent: number): number {
  const scaled = BigInt(netTotalCents) * BigInt(taxRatePercent);
  return Number(roundHalfUpBigInt(scaled, BigInt(100)));
}

export function computeGrossTotalCents(netTotalCents: number, taxTotalCents: number): number {
  return netTotalCents + taxTotalCents;
}

export type QuoteTotals = {
  netTotalCents: number;
  taxTotalCents: number;
  grossTotalCents: number;
};

/** Berechnet alle drei Angebots-Summen aus den bereits exakten Zeilen-Summen. */
export function computeQuoteTotals(lineTotalsNetCents: number[], taxRatePercent: number): QuoteTotals {
  const netTotalCents = computeNetTotalCents(lineTotalsNetCents);
  const taxTotalCents = computeTaxTotalCents(netTotalCents, taxRatePercent);
  const grossTotalCents = computeGrossTotalCents(netTotalCents, taxTotalCents);
  return { netTotalCents, taxTotalCents, grossTotalCents };
}

/**
 * Auto-Freigabe-Entscheidung: kapselt die Regel an einer Stelle, damit MS 8c
 * (KI-Entwurf) dieselbe Logik wiederverwenden kann. Ueber dem Limit IMMER
 * manuelle Freigabe, unabhaengig davon wer/was das Angebot erstellt hat.
 */
export function qualifiesForAutoRelease(
  grossTotalCents: number,
  settings: { autoReleaseEnabled: boolean; autoReleaseLimitCents: number },
): boolean {
  return settings.autoReleaseEnabled && grossTotalCents <= settings.autoReleaseLimitCents;
}
