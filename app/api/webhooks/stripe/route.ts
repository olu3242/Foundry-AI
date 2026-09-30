import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/billing/stripe";
import { serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { log, reportError } from "@/lib/telemetry";

export const dynamic = "force-dynamic";

/**
 * Stripe → program seats. Signature-verified on the raw body; each event id is processed once
 * (stripe_events), so Stripe's at-least-once retries are safe. Unknown event types are acknowledged.
 */
export async function POST(request: NextRequest) {
  const stripe = getStripe();
  const secret = serverEnv().STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return NextResponse.json({ error: "billing not configured" }, { status: 503 });

  const raw = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, request.headers.get("stripe-signature") ?? "", secret);
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error: dupe } = await admin.from("stripe_events").insert({ id: event.id, type: event.type });
  if (dupe) {
    if (dupe.code === "23505") return NextResponse.json({ received: true, duplicate: true });
    return NextResponse.json({ error: "storage unavailable" }, { status: 500 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const s = event.data.object;
      const programId = s.metadata?.program_id ?? s.client_reference_id;
      if (programId && s.mode === "subscription") {
        await admin.from("programs").update({
          stripe_customer_id: typeof s.customer === "string" ? s.customer : s.customer?.id,
          stripe_subscription_id: typeof s.subscription === "string" ? s.subscription : s.subscription?.id,
          subscription_status: "active",
        }).eq("id", programId);
      }
    } else if (event.type === "invoice.paid") {
      // B20: revenue for unit economics.
      const inv = event.data.object;
      const subId = inv.parent?.subscription_details?.subscription;
      const { data: program } = subId
        ? await admin.from("programs").select("id").eq("stripe_subscription_id", typeof subId === "string" ? subId : subId.id).maybeSingle()
        : { data: null };
      await admin.from("revenue_events").upsert({
        source: "stripe", external_id: inv.id, program_id: program?.id ?? null, amount_minor: inv.amount_paid,
        currency: inv.currency.toUpperCase(), occurred_at: new Date((inv.status_transitions?.paid_at ?? inv.created) * 1000).toISOString(),
      }, { onConflict: "external_id" });
    } else if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted" || event.type === "customer.subscription.created") {
      const sub = event.data.object;
      const programId = sub.metadata?.program_id;
      const item = sub.items.data[0];
      const update = {
        subscription_status: event.type === "customer.subscription.deleted" ? "canceled" : sub.status,
        stripe_subscription_id: sub.id,
        current_period_end: item?.current_period_end ? new Date(item.current_period_end * 1000).toISOString() : null,
        ...(item?.quantity ? { seats: item.quantity } : {}),
      };
      const query = admin.from("programs").update(update);
      await (programId ? query.eq("id", programId) : query.eq("stripe_subscription_id", sub.id));
    }
    log("info", "stripe.webhook", { id: event.id, type: event.type });
    return NextResponse.json({ received: true });
  } catch (error) {
    // Release the id so Stripe's retry is processed.
    await admin.from("stripe_events").delete().eq("id", event.id);
    reportError(error, { msg: "stripe.webhook.failed", id: event.id, type: event.type });
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }
}
