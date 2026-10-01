import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPaystackSignature, type PaystackTransaction } from "@/lib/payments/paystack";
import { applyTransaction } from "@/lib/payments/apply";
import { log, reportError } from "@/lib/telemetry";

export const dynamic = "force-dynamic";

type RefundData = { id?: number | string; refund_reference?: string; status?: string; amount?: number; transaction_reference?: string;
  transaction?: { id?: number | string; reference?: string } };

/** B43 Paystack events, verified on the raw body (HMAC-SHA512 with the secret key). Idempotent per event. */
export async function POST(request: NextRequest) {
  const secret = serverEnv().PAYSTACK_SECRET_KEY;
  const raw = await request.text();
  if (!secret || !verifyPaystackSignature(raw, request.headers.get("x-paystack-signature"), secret)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }
  const admin = createAdminClient();
  try {
    const { event, data } = JSON.parse(raw) as { event: string; data: Record<string, unknown> };
    let result: unknown = "ignored";
    if (event === "charge.success") {
      result = await applyTransaction(admin, data as unknown as PaystackTransaction, "charge");
    } else if (event.startsWith("refund.")) {
      const d = data as RefundData;
      let txId = d.transaction?.id != null ? String(d.transaction.id) : null;
      const ref = d.transaction?.reference ?? d.transaction_reference;
      if (!txId && ref) {
        const { data: pr } = await admin.from("payment_requests").select("provider_transaction_id").eq("reference", ref).maybeSingle();
        txId = pr?.provider_transaction_id ?? null;
      }
      const refundId = String(d.id ?? d.refund_reference ?? "");
      const status = event === "refund.processed" ? "processed" : event === "refund.failed" ? "failed" : "pending";
      const { data: r, error } = await admin.rpc("apply_refund_result", { p_transaction_id: txId ?? `unknown:${ref ?? ""}`, p_provider_refund_id: refundId,
        p_status: status, p_amount_minor: Number(d.amount ?? 0), p_event_id: `paystack:${event}:${refundId}`, p_detail: { reference: ref ?? null } });
      if (error) throw error;
      result = r;
    } else if (event.startsWith("charge.dispute.")) {
      const tx = (data as { transaction?: { id?: number | string }; id?: number | string; status?: string });
      const { data: r, error } = await admin.rpc("record_payment_dispute", { p_transaction_id: String(tx.transaction?.id ?? ""), p_status: tx.status ?? event,
        p_event_id: `paystack:${event}:${tx.id ?? ""}`, p_detail: { event } });
      if (error) throw error;
      result = r;
    }
    log("info", "paystack.webhook", { event, result: String(result) });
    return NextResponse.json({ received: true });
  } catch (error) {
    reportError(error, { msg: "paystack.webhook.failed" });
    return NextResponse.json({ error: "processing failed" }, { status: 500 });   // Paystack retries
  }
}
