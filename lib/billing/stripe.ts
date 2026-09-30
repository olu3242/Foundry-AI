import "server-only";
import Stripe from "stripe";
import { serverEnv } from "@/lib/env";

let stripe: Stripe | null | undefined;

/** Null when billing isn't configured: programs then run on pilot seats only. */
export function getStripe() {
  if (stripe === undefined) {
    const key = serverEnv().STRIPE_SECRET_KEY;
    stripe = key ? new Stripe(key, { maxNetworkRetries: 2, timeout: 20_000 }) : null;
  }
  return stripe;
}

export function billingConfigured() {
  const env = serverEnv();
  return Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET && env.STRIPE_PROGRAM_PRICE_ID);
}
