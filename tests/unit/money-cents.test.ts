import { describe, expect, it } from "vitest";
import {
  centsToDecimalString,
  centsToEuroInputValue,
  formatCentsAsEuro,
  parseEuroInputToCents,
} from "@/core/money/cents";

describe("parseEuroInputToCents", () => {
  it("parst 19,99 exakt als 1999 Cent (kein Float-Rundungsdrift)", () => {
    expect(parseEuroInputToCents("19,99")).toBe(1999);
  });

  it("parst ganze Euro-Betraege ohne Komma", () => {
    expect(parseEuroInputToCents("20")).toBe(2000);
  });

  it("ergaenzt eine einstellige Nachkommastelle auf zwei", () => {
    expect(parseEuroInputToCents("0,5")).toBe(50);
  });

  it("akzeptiert 0,00", () => {
    expect(parseEuroInputToCents("0,00")).toBe(0);
  });

  it("lehnt ungueltige Eingaben ab", () => {
    expect(parseEuroInputToCents("abc")).toBeNull();
    expect(parseEuroInputToCents("19.99")).toBeNull();
    expect(parseEuroInputToCents("19,999")).toBeNull();
    expect(parseEuroInputToCents("-5")).toBeNull();
    expect(parseEuroInputToCents("")).toBeNull();
  });
});

describe("Cent<->Euro Rundtrip", () => {
  it("19,99 € -> 1999 Cent -> 19,99 € (Review-Checkpoint)", () => {
    const cents = parseEuroInputToCents("19,99");
    expect(cents).toBe(1999);
    // Intl.NumberFormat trennt Zahl und Symbol mit einem schmalen geschuetzten
    // Leerzeichen (U+202F), nicht mit einem normalen Space - Whitespace daher
    // normalisieren statt auf ein exaktes Zeichen zu bestehen.
    expect(formatCentsAsEuro(cents!).replace(/\s/g, " ")).toBe("19,99 €");
  });

  it("centsToEuroInputValue liefert das Eingabeformat fuers Bearbeiten-Formular", () => {
    expect(centsToEuroInputValue(1999)).toBe("19,99");
    expect(centsToEuroInputValue(2000)).toBe("20,00");
    expect(centsToEuroInputValue(5)).toBe("0,05");
  });

  it("bleibt exakt ueber viele krumme Betraege hinweg (keine Float-Drift)", () => {
    for (let cents = 0; cents <= 10000; cents += 1) {
      const input = centsToEuroInputValue(cents);
      expect(parseEuroInputToCents(input)).toBe(cents);
    }
  });
});

describe("centsToDecimalString (MS 11b, sevdesk-Payload)", () => {
  it("bildet Punkt-Dezimalstrings statt deutschem Komma, z. B. fuer 12,5 x 19,99 €", () => {
    expect(centsToDecimalString(1999)).toBe("19.99");
    expect(centsToDecimalString(2000)).toBe("20.00");
    expect(centsToDecimalString(5)).toBe("0.05");
    expect(centsToDecimalString(0)).toBe("0.00");
  });

  it("bleibt exakt (keine Float-Drift) fuer krumme Cent-Betraege", () => {
    for (let cents = 0; cents <= 10000; cents += 7) {
      const decimal = centsToDecimalString(cents);
      expect(Math.round(Number(decimal) * 100)).toBe(cents);
    }
  });
});
