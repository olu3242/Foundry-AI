"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireBusiness } from "@/lib/auth/guards";
import { redirect } from "next/navigation";
import { fail, friendlyDbError, type ActionState } from "@/lib/actions";
import { publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { customerEmail, initializeTransaction, PaymentProviderError, paystackConfigured, paystackCurrencies } from "@/lib/payments/paystack";

export async function choosePlan(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z.object({ businessId: z.uuid(), plan: z.string().regex(/^[a-z0-9_]{2,40}$/) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Choose a plan.");
  const { supabase } = await requireBusiness(parsed.data.businessId, ["owner"]);
  const { error } = await supabase.rpc("choose_plan", { p_business_id: parsed.data.businessId, p_plan_key: parsed.data.plan });
  if (error) return fail(friendlyDbError(error));
  revalidatePath(`/b/${parsed.data.businessId}/plan`);
  return { ok: true, message: "Plan updated." };
}

/** B43: open a Paystack checkout for an open business-paid charge. */
export async function payCharge(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z.object({ businessId: z.uuid(), chargeId: z.uuid() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Choose a charge.");
  const { businessId, chargeId } = parsed.data;
  const { supabase } = await requireBusiness(businessId, ["owner", "staff"]);
  if (!paystackConfigured()) return fail("Online payment isn't available yet. Pay by mobile money or bank transfer and send us the reference.");
  const { data, error } = await supabase.rpc("create_payment_request", { p_billable_event_id: chargeId });
  if (error) return fail(friendlyDbError(error));
  const pr = data as { id: string; reference: string; amount_minor: number; currency: string; checkout_url: string | null; email: string | null; phone: string | null };
  if (!paystackCurrencies().includes(pr.currency.toUpperCase())) return fail(`Online payment isn't available in ${pr.currency} yet.`);
  let checkout = pr.checkout_url;
  if (!checkout) {
    const admin = createAdminClient();
    try {
      const init = await initializeTransaction({
        email: customerEmail(pr.email, pr.phone), amountMinor: pr.amount_minor, currency: pr.currency, reference: pr.reference,
        callbackUrl: `${publicEnv.NEXT_PUBLIC_SITE_URL}/api/payments/paystack/return`,
        metadata: { payment_request_id: pr.id, billable_event_id: chargeId, business_id: businessId },
      });
      await admin.rpc("record_payment_initialized", { p_id: pr.id, p_access_code: init.access_code, p_checkout_url: init.authorization_url, p_error: "" });
      checkout = init.authorization_url;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await admin.rpc("record_payment_initialized", { p_id: pr.id, p_access_code: "", p_checkout_url: "", p_error: message });
      return fail(e instanceof PaymentProviderError && e.permanent ? message : "The payment service didn't respond. Try again in a minute.");
    }
  }
  redirect(checkout);
}

/** B58: the owner accepts or rejects an offer (rejections carry a reason). Acceptance is not revenue. */
export async function respondToOffer(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z.object({ businessId: z.uuid(), offerId: z.uuid(), accept: z.enum(["true", "false"]),
    reason: z.enum(["too_expensive", "no_value_yet", "no_cash_now", "prefers_free", "trust", "sponsor_pays", "other", ""]).optional(), note: z.string().max(500).optional() })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Choose an answer.");
  const { businessId, offerId, accept, reason, note } = parsed.data;
  const { supabase } = await requireBusiness(businessId, ["owner"]);
  const { error } = await supabase.rpc("respond_to_offer", { p_offer_id: offerId, p_accept: accept === "true", p_reason: reason || undefined, p_note: note || undefined });
  if (error) return fail(friendlyDbError(error));
  revalidatePath(`/b/${businessId}/plan`);
  return { ok: true, message: accept === "true" ? "Accepted. Your plan is updated; the charge appears below when billed." : "Thanks — noted." };
}
