import { createHmac, timingSafeEqual } from "node:crypto";

/** x-paystack-signature = HMAC-SHA512(raw body, secret key), hex. */
export function verifyPaystackSignature(raw: string, header: string | null, secret: string) {
  if (!header) return false;
  const expected = createHmac("sha512", secret).update(raw).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(header.trim());
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Paystack statuses → apply_payment_result statuses. Anything unknown stays pending (re-verified later). */
export function mapChargeStatus(s: string): "success" | "failed" | "abandoned" | "pending" {
  return s === "success" ? "success" : s === "failed" || s === "reversed" ? "failed" : s === "abandoned" ? "abandoned" : "pending";
}
