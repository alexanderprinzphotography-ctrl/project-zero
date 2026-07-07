"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/core/supabase/server";
import { getUserContext } from "@/core/auth/get-user-context";
import { getStripeClient, resolvePriceId, type BillingInterval, type PlanTier } from "@/core/billing/stripe";

export type CheckoutActionState = { error: string | null };

function isValidTier(value: string): value is PlanTier {
  return value === "basic" || value === "pro";
}

function isValidInterval(value: string): value is BillingInterval {
  return value === "month" || value === "year";
}

export async function createCheckoutSession(
  _prevState: CheckoutActionState,
  formData: FormData,
): Promise<CheckoutActionState> {
  const context = await getUserContext();
  if (!context) return { error: "Bitte anmelden." };
  if (context.role !== "admin") {
    return { error: "Nur Admins können ein Abo abschließen." };
  }

  const tier = String(formData.get("tier") ?? "");
  const interval = String(formData.get("interval") ?? "");
  if (!isValidTier(tier) || !isValidInterval(interval)) {
    return { error: "Ungültige Auswahl." };
  }

  let priceId: string;
  try {
    priceId = resolvePriceId(tier, interval);
  } catch {
    return { error: "Dieser Plan ist aktuell nicht verfügbar." };
  }

  const supabase = await createClient();
  const { data: company } = await supabase
    .from("companies")
    .select("stripe_customer_id, name")
    .eq("id", context.companyId)
    .single();

  const stripe = getStripeClient();
  let customerId = company?.stripe_customer_id ?? null;

  // Stripe-Aufrufe koennen aus vielen Gruenden fehlschlagen (ungueltige/
  // veraltete customer_id, falsche Preis-Konfiguration, Netzwerk) - abgefangen
  // statt den Nutzer mit einer rohen 500-Seite stehen zu lassen. redirect()
  // bewusst AUSSERHALB des try/catch (wirft intern selbst eine Kontrollfluss-
  // Exception, die hier nicht abgefangen werden darf).
  let sessionUrl: string | null;
  try {
    if (!customerId) {
      const customer = await stripe.customers.create({
        name: company?.name ?? context.companyName,
        email: context.email,
        metadata: { company_id: context.companyId },
      });
      customerId = customer.id;

      // stripe_customer_id ist per Migration fuer "authenticated" gesperrt
      // (siehe MS 9a) - das kontrollierte, einmalige Setzen laeuft
      // ausschliesslich ueber diese SECURITY DEFINER-Funktion, nicht per
      // direktem Update.
      const { error: rpcError } = await supabase.rpc("ensure_stripe_customer_id", {
        p_company_id: context.companyId,
        p_customer_id: customerId,
      });
      if (rpcError) {
        return { error: "Stripe-Kunde konnte nicht angelegt werden." };
      }
    }

    const origin = (await headers()).get("origin");
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: context.companyId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/konto/upgrade/erfolg?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/konto/upgrade?abgebrochen=1`,
    });
    sessionUrl = session.url;
  } catch (err) {
    console.error("Stripe-Checkout fehlgeschlagen:", err);
    return { error: "Checkout konnte nicht gestartet werden. Bitte erneut versuchen." };
  }

  if (!sessionUrl) {
    return { error: "Checkout konnte nicht gestartet werden." };
  }

  redirect(sessionUrl);
}

// useActionState ruft immer mit (state, formData) auf - hier wird keins von
// beidem gebraucht (kein Formularfeld noetig, um die Portal-Session zu
// erstellen), daher beide bewusst ungenutzt.
export async function createPortalSession(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _prevState: CheckoutActionState,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _formData: FormData,
): Promise<CheckoutActionState> {
  const context = await getUserContext();
  if (!context) return { error: "Bitte anmelden." };
  if (context.role !== "admin") {
    return { error: "Nur Admins können das Abo verwalten." };
  }

  const supabase = await createClient();
  const { data: company } = await supabase
    .from("companies")
    .select("stripe_customer_id")
    .eq("id", context.companyId)
    .single();

  if (!company?.stripe_customer_id) {
    return { error: "Noch kein Stripe-Kunde vorhanden – bitte zuerst ein Abo abschließen." };
  }

  let portalUrl: string;
  try {
    const origin = (await headers()).get("origin");
    const stripe = getStripeClient();
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: company.stripe_customer_id,
      return_url: `${origin}/konto/upgrade`,
    });
    portalUrl = portalSession.url;
  } catch (err) {
    console.error("Stripe-Portal fehlgeschlagen:", err);
    return { error: "Kundenportal konnte nicht geöffnet werden. Bitte erneut versuchen." };
  }

  redirect(portalUrl);
}
