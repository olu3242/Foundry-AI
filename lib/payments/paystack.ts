import "server-only";
import { serverEnv } from "@/lib/env";
import { safeFetch } from "@/lib/net/safe-fetch";

export { mapChargeStatus, verifyPaystackSignature } from "./signature";

/**
 * B43 Paystack adapter (Ghana/Nigeria: mobile money, card, bank). Provider truth stays at Paystack;
 * callers mirror results into payment_requests via apply_payment_result / apply_refund_result.
 */
export class PaymentProviderError extends Error {
  constructor(message: string, readonly permanent: boolean) { super(message); }
}

export const paystackConfigured = () => Boolean(serverEnv().PAYSTACK_SECRET_KEY);
export const paystackCurrencies = () => serverEnv().PAYSTACK_CURRENCIES.split(",").map((c) => c.trim().toUpperCase()).filter(Boolean);

async function call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const env = serverEnv();
  if (!env.PAYSTACK_SECRET_KEY) throw new PaymentProviderError("Paystack is not configured", true);
  const res = await safeFetch(`${env.PAYSTACK_API_BASE ?? "https://api.paystack.co"}${path}`, {
    method,
    headers: { Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = JSON.parse(res.text || "{}") as { status?: boolean; message?: string; data?: T };
  if (!res.ok || !json.status || json.data === undefined) {
    throw new PaymentProviderError(json.message ?? `Paystack HTTP ${res.status}`, res.status >= 400 && res.status < 500 && res.status !== 429);
  }
  return json.data;
}

export function customerEmail(email: string | null, phone: string | null) {
  if (email) return email;
  const domain = serverEnv().PAYSTACK_CUSTOMER_EMAIL_DOMAIN;
  if (!phone || !domain) throw new PaymentProviderError("Add an email to your account to pay online", true);
  return `${phone.replace(/\D/g, "")}@${domain}`;
}

export function initializeTransaction(input: { email: string; amountMinor: number; currency: string; reference: string; callbackUrl: string; metadata: Record<string, string> }) {
  return call<{ authorization_url: string; access_code: string; reference: string }>("POST", "/transaction/initialize", {
    email: input.email, amount: input.amountMinor, currency: input.currency, reference: input.reference, callback_url: input.callbackUrl,
    channels: ["mobile_money", "card", "bank", "bank_transfer", "ussd"], metadata: input.metadata,
  });
}

export type PaystackTransaction = { id: number; status: string; reference: string; amount: number; currency: string; channel: string; paid_at: string | null; gateway_response?: string };

export const verifyTransaction = (reference: string) => call<PaystackTransaction>("GET", `/transaction/verify/${encodeURIComponent(reference)}`);

export const createRefund = (transactionId: string, amountMinor: number) =>
  call<{ id: number; status: string }>("POST", "/refund", { transaction: transactionId, amount: amountMinor });
