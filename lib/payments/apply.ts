import "server-only";
import type { AdminSupabase } from "@/lib/supabase/admin";
import { mapChargeStatus, verifyTransaction, type PaystackTransaction } from "./paystack";

/** Mirrors one Paystack transaction into Foundry (idempotent per transaction + status). */
export async function applyTransaction(admin: AdminSupabase, tx: PaystackTransaction, kind: "charge" | "verify") {
  const status = mapChargeStatus(tx.status);
  const { data, error } = await admin.rpc("apply_payment_result", {
    p_reference: tx.reference, p_status: status, p_transaction_id: String(tx.id), p_amount_minor: tx.amount, p_currency: tx.currency,
    p_channel: tx.channel, p_paid_at: tx.paid_at ?? new Date().toISOString(), p_event_id: `paystack:${tx.id}:${tx.status}`, p_kind: kind,
    p_detail: { gateway_response: tx.gateway_response ?? tx.status },
  });
  if (error) throw error;
  return data as string;
}

/** Asks Paystack for the truth about a reference and mirrors it. */
export async function verifyAndApply(admin: AdminSupabase, reference: string) {
  const tx = await verifyTransaction(reference);
  return applyTransaction(admin, tx, "verify");
}
