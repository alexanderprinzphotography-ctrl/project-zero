import { describe, expect, it } from "vitest";
import {
  computeGrossTotalCents,
  computeLineTotalNetCents,
  computeNetTotalCents,
  computeQuoteTotals,
  computeTaxTotalCents,
  hundredthsToDecimalString,
  hundredthsToQuantityInputValue,
  parseQuantityToHundredths,
  qualifiesForAutoRelease,
} from "@/core/money/quote-math";

describe("parseQuantityToHundredths", () => {
  it("parst 12,5 als 1250 Hundertstel", () => {
    expect(parseQuantityToHundredths("12,5")).toBe(1250);
  });

  it("lehnt ungueltige Eingaben ab", () => {
    expect(parseQuantityToHundredths("abc")).toBeNull();
    expect(parseQuantityToHundredths("-1")).toBeNull();
    expect(parseQuantityToHundredths("")).toBeNull();
  });
});

describe("computeLineTotalNetCents (Review-Checkpoint: 12,5 x 19,99 €)", () => {
  it("rechnet 12,5 x 19,99 € exakt auf 24988 Cent (249,88 €)", () => {
    const quantityHundredths = parseQuantityToHundredths("12,5")!;
    const lineTotal = computeLineTotalNetCents(quantityHundredths, 1999);
    // 12.5 * 19.99 = 249.875 € = 24987.5 Cent -> kaufmaennisch aufgerundet -> 24988
    expect(lineTotal).toBe(24988);
  });

  it("rundet exakte halbe Cent kaufmaennisch auf (nicht ab)", () => {
    // 0,5 x 1 Cent = 0,5 Cent -> muss auf 1 Cent aufrunden
    const quantityHundredths = parseQuantityToHundredths("0,5")!;
    expect(computeLineTotalNetCents(quantityHundredths, 1)).toBe(1);
  });

  it("bleibt bei glatten Werten exakt (keine Float-Artefakte)", () => {
    const quantityHundredths = parseQuantityToHundredths("3")!;
    expect(computeLineTotalNetCents(quantityHundredths, 1999)).toBe(5997);
  });

  it("verarbeitet grosse Mengen ohne Praezisionsverlust", () => {
    const quantityHundredths = parseQuantityToHundredths("999,99")!;
    // 999.99 * 1999 Cent = 1998980.01 Cent -> kaufmaennisch gerundet 1998980
    expect(computeLineTotalNetCents(quantityHundredths, 1999)).toBe(1998980);
  });
});

describe("Summen: net/tax/gross", () => {
  it("summiert Zeilen-Totale als reine Ganzzahl-Addition", () => {
    expect(computeNetTotalCents([24988, 5997, 1998980])).toBe(2029965);
  });

  it("berechnet MwSt als Netto x Steuersatz, kaufmaennisch gerundet", () => {
    // 2029965 * 19 = 38.569.335 -> /100 = 385693,35 -> abgerundet 385693
    expect(computeTaxTotalCents(2029965, 19)).toBe(385693);
  });

  it("Brutto = Netto + MwSt exakt", () => {
    expect(computeGrossTotalCents(2029965, 385693)).toBe(2415658);
  });

  it("computeQuoteTotals liefert alle drei Summen konsistent zueinander", () => {
    const totals = computeQuoteTotals([24988, 5997, 1998980], 19);
    expect(totals.netTotalCents).toBe(2029965);
    expect(totals.taxTotalCents).toBe(385693);
    expect(totals.grossTotalCents).toBe(totals.netTotalCents + totals.taxTotalCents);
  });

  it("MwSt-Rundung: 100 Cent Netto x 19% = 19 Cent exakt (kein Rundungsfall)", () => {
    expect(computeTaxTotalCents(100, 19)).toBe(19);
  });
});

describe("Rundtrip Hundertstel <-> Anzeige/Speicherformat", () => {
  it("hundredthsToQuantityInputValue und hundredthsToDecimalString sind konsistent", () => {
    expect(hundredthsToQuantityInputValue(1250)).toBe("12,50");
    expect(hundredthsToDecimalString(1250)).toBe("12.50");
  });

  it("bleibt exakt ueber viele krumme Mengen hinweg", () => {
    for (let hundredths = 1; hundredths <= 5000; hundredths += 1) {
      const input = hundredthsToQuantityInputValue(hundredths);
      expect(parseQuantityToHundredths(input)).toBe(hundredths);
    }
  });
});

describe("qualifiesForAutoRelease", () => {
  it("greift knapp unter dem Limit", () => {
    expect(
      qualifiesForAutoRelease(9999, { autoReleaseEnabled: true, autoReleaseLimitCents: 10000 }),
    ).toBe(true);
  });

  it("greift exakt am Limit (inklusive)", () => {
    expect(
      qualifiesForAutoRelease(10000, { autoReleaseEnabled: true, autoReleaseLimitCents: 10000 }),
    ).toBe(true);
  });

  it("greift NICHT knapp ueber dem Limit", () => {
    expect(
      qualifiesForAutoRelease(10001, { autoReleaseEnabled: true, autoReleaseLimitCents: 10000 }),
    ).toBe(false);
  });

  it("greift nie, wenn Auto-Freigabe deaktiviert ist", () => {
    expect(
      qualifiesForAutoRelease(1, { autoReleaseEnabled: false, autoReleaseLimitCents: 1000000 }),
    ).toBe(false);
  });
});
