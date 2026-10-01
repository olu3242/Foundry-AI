import "server-only";
import type { JobHandler } from "@/lib/jobs/types";
import { verifyAndApply } from "./apply";
import { PaymentProviderError, paystackConfigured } from "./paystack";

/** B43 reconciliation: payments Foundry has not heard back about are verified with the provider. */
export const reconcilePaymentsJob: JobHandler = async ({ admin }) => {
  if (!paystackConfigured()) return { skipped: "paystack_not_configured" };
  const { data, error } = await admin.rpc("payments_to_verify", { p_limit: 50 });
  if (error) throw error;
  const result: Record<string, number> = {};
  for (const r of data ?? []) {
    let outcome: string;
    try {
      outcome = await verifyAndApply(admin, r.reference);
    } catch (e) {
      // Never opened at the provider: abandoned after a day; otherwise try again next run.
      if (e instanceof PaymentProviderError && e.permanent && Date.now() - new Date(r.created_at).getTime() > 864e5) {
        const { data: applied, error: applyError } = await admin.rpc("apply_payment_result", {
          p_reference: r.reference, p_status: "abandoned", p_transaction_id: "", p_amount_minor: r.amount_minor, p_currency: r.currency,
          p_channel: "", p_paid_at: new Date().toISOString(), p_event_id: `paystack:unseen:${r.reference}`, p_kind: "verify", p_detail: { gateway_response: e.message },
        });
        if (applyError) throw applyError;
        outcome = applied as string;
      } else {
        outcome = "verify_error";
      }
    }
    result[outcome] = (result[outcome] ?? 0) + 1;
  }
  return result;
};
