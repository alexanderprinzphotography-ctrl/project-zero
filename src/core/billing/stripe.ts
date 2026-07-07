import Stripe from "stripe";

/**
 * Stripe-Kern: Preis-<->Tier/Intervall-Mapping ausschliesslich ueber Env-
 * Variablen (die 4 Price-IDs aus dem Stripe-Dashboard, Test-Modus) - nie
 * hartcodierte Preise im Code, die von Stripe abweichen koennten. Secret Key
 * wird NUR hier (serverseitig) verwendet, nie im Client-Bundle.
 */

export type PlanTier = "basic" | "pro";
export type BillingInterval = "month" | "year";

let stripeClient: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (stripeClient) return stripeClient;
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY ist nicht konfiguriert.");
  }
  stripeClient = new Stripe(secretKey);
  return stripeClient;
}

type PriceMapping = { tier: PlanTier; interval: BillingInterval; priceId: string };

const TIERS: PlanTier[] = ["basic", "pro"];
const INTERVALS: BillingInterval[] = ["month", "year"];

function envKeyFor(tier: PlanTier, interval: BillingInterval): string {
  return `STRIPE_PRICE_${tier.toUpperCase()}_${interval === "month" ? "MONTHLY" : "YEARLY"}`;
}

function getAllPriceMappings(): PriceMapping[] {
  const mappings: PriceMapping[] = [];
  for (const tier of TIERS) {
    for (const interval of INTERVALS) {
      const priceId = process.env[envKeyFor(tier, interval)];
      if (priceId) mappings.push({ tier, interval, priceId });
    }
  }
  return mappings;
}

export function resolvePriceId(tier: PlanTier, interval: BillingInterval): string {
  const priceId = process.env[envKeyFor(tier, interval)];
  if (!priceId) {
    throw new Error(`${envKeyFor(tier, interval)} ist nicht konfiguriert.`);
  }
  return priceId;
}

/** Ordnet eine von Stripe zurueckgegebene price.id einem Tier/Intervall zu - genutzt vom Webhook, NIE umgekehrt (die KI/der Client waehlt nie den Preis). */
export function resolveTierAndInterval(priceId: string): { tier: PlanTier; interval: BillingInterval } | null {
  const mapping = getAllPriceMappings().find((m) => m.priceId === priceId);
  return mapping ? { tier: mapping.tier, interval: mapping.interval } : null;
}

export type DisplayPrice = {
  tier: PlanTier;
  interval: BillingInterval;
  priceId: string;
  unitAmountCents: number | null;
  currency: string;
};

/** Fragt die tatsaechlich in Stripe konfigurierten Preise live ab, damit die Anzeige nie von Stripe abweicht (keine Doppelpflege im Code). */
export async function getDisplayPrices(): Promise<DisplayPrice[]> {
  const stripe = getStripeClient();
  const mappings = getAllPriceMappings();

  return Promise.all(
    mappings.map(async (m) => {
      const price = await stripe.prices.retrieve(m.priceId);
      return {
        tier: m.tier,
        interval: m.interval,
        priceId: m.priceId,
        unitAmountCents: price.unit_amount,
        currency: price.currency,
      };
    }),
  );
}
