import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripeClient, resolveTierAndInterval } from "@/core/billing/stripe";
import { createAdminClient } from "@/core/supabase/admin";

/**
 * Stripe-Webhook: einzige Stelle, an der plan_status/plan_tier/etc. geschrieben
 * werden (siehe MS 9a-Migration: fuer "authenticated" gesperrt). Signatur wird
 * IMMER verifiziert, bevor irgendetwas verarbeitet wird - ein Request ohne
 * gueltige Signatur wird abgelehnt, unabhaengig vom Inhalt.
 */

function mapStripeStatus(status: Stripe.Subscription.Status): "active" | "past_due" | "canceled" {
  if (status === "active" || status === "trialing") return "active";
  if (status === "past_due") return "past_due";
  return "canceled";
}

async function applySubscriptionState(
  supabase: ReturnType<typeof createAdminClient>,
  subscription: Stripe.Subscription,
): Promise<void> {
  const priceId = subscription.items.data[0]?.price.id;
  const mapping = priceId ? resolveTierAndInterval(priceId) : null;
  const periodEndUnix = subscription.items.data[0]?.current_period_end ?? null;

  await supabase
    .from("companies")
    .update({
      plan_status: mapStripeStatus(subscription.status),
      plan_tier: mapping?.tier ?? null,
      billing_interval: mapping?.interval ?? null,
      stripe_subscription_id: subscription.id,
      current_period_end: periodEndUnix ? new Date(periodEndUnix * 1000).toISOString() : null,
    })
    .eq("stripe_customer_id", String(subscription.customer));
}

export async function POST(request: Request): Promise<NextResponse> {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return new NextResponse("Fehlende Signatur", { status: 400 });
  }

  // Rohen Body-Text verwenden (nicht request.json()) - die Signaturpruefung
  // braucht die exakten Bytes, wie Stripe sie gesendet hat.
  const rawBody = await request.text();
  const stripe = getStripeClient();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("Stripe-Webhook: ungültige Signatur", err);
    return new NextResponse("Ungültige Signatur", { status: 400 });
  }

  const supabase = createAdminClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const companyId = session.client_reference_id;
        if (companyId && session.customer) {
          await supabase
            .from("companies")
            .update({
              stripe_customer_id: String(session.customer),
              stripe_subscription_id: session.subscription ? String(session.subscription) : null,
            })
            .eq("id", companyId);
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        await applySubscriptionState(supabase, event.data.object as Stripe.Subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await supabase
          .from("companies")
          .update({ plan_status: "canceled" })
          .eq("stripe_customer_id", String(subscription.customer));
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.customer) {
          await supabase
            .from("companies")
            .update({ plan_status: "active" })
            .eq("stripe_customer_id", String(invoice.customer));
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.customer) {
          await supabase
            .from("companies")
            .update({ plan_status: "past_due" })
            .eq("stripe_customer_id", String(invoice.customer));
        }
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error("Stripe-Webhook: Verarbeitung fehlgeschlagen", event.type, err);
    return new NextResponse("Verarbeitungsfehler", { status: 500 });
  }

  return NextResponse.json({ received: true });
}
