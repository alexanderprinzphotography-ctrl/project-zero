import { beforeAll, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "@/core/crypto/secret-box";

beforeAll(() => {
  process.env.INTEGRATION_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
});

describe("encryptSecret/decryptSecret", () => {
  it("liefert den Klartext nach Roundtrip unveraendert zurueck", () => {
    const plaintext = "sk_test_abcdef1234567890";
    expect(decryptSecret(encryptSecret(plaintext))).toBe(plaintext);
  });

  it("erzeugt bei jedem Aufruf ein anderes Chiffrat (zufaelliger IV)", () => {
    const plaintext = "gleicher-schluessel";
    expect(encryptSecret(plaintext)).not.toBe(encryptSecret(plaintext));
  });

  it("wirft bei manipuliertem Chiffrat (AuthTag-Pruefung schlaegt fehl)", () => {
    const encoded = encryptSecret("geheim");
    const raw = Buffer.from(encoded, "base64");
    raw[raw.length - 1] ^= 0xff;
    expect(() => decryptSecret(raw.toString("base64"))).toThrow();
  });

  it("wirft ohne konfigurierten Schluessel", () => {
    const previous = process.env.INTEGRATION_ENCRYPTION_KEY;
    delete process.env.INTEGRATION_ENCRYPTION_KEY;
    expect(() => encryptSecret("x")).toThrow();
    process.env.INTEGRATION_ENCRYPTION_KEY = previous;
  });
});
