import type { createClient } from "@/core/supabase/server";

/**
 * Entitlement-Abfrage fuer Pro-Features (aktuell: KI-Angebotserstellung).
 * Ruft ausschliesslich die serverseitige SECURITY DEFINER-Funktion
 * company_has_feature() auf, die den Firmen-Status direkt aus der DB liest -
 * das Ergebnis wird NIE aus Client-Daten abgeleitet oder ihm vertraut.
 */
export type FeatureKey = "ki";

export async function hasFeature(
  supabase: Awaited<ReturnType<typeof createClient>>,
  featureKey: FeatureKey,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("company_has_feature", { feature_key: featureKey });
  if (error) {
    console.error("company_has_feature fehlgeschlagen:", error);
    return false;
  }
  return data === true;
}
