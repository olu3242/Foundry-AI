"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { policyDenial } from "@/lib/policy";
import { requireBusiness } from "@/lib/auth/guards";
import { fail, friendlyDbError, type ActionState } from "@/lib/actions";
import { toMinor } from "@/lib/money";

export async function sharePackage(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z.object({
    businessId: z.uuid(), productId: z.uuid(), amount: z.coerce.number().positive(), purpose: z.string().trim().min(3).max(500),
    consent: z.literal("on"),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Add an amount, a purpose, and tick the consent box.");
  const p = parsed.data;
  const { business, supabase } = await requireBusiness(p.businessId, ["owner"]);
  const denied = await policyDenial(supabase, "finance.evidence_share", p.businessId, { product_id: p.productId, amount_minor: toMinor(p.amount, business.currency) });
  if (denied) return fail(denied);
  const sections = formData.getAll("sections").map(String);
  const { error } = await supabase.rpc("submit_evidence_package", {
    p_business_id: p.businessId, p_product_id: p.productId, p_sections: sections,
    p_amount_minor: toMinor(p.amount, business.currency), p_purpose: p.purpose, p_consent: true,
  });
  if (error) return fail(friendlyDbError(error));
  revalidatePath(`/b/${p.businessId}/finance`);
  return { ok: true, message: "Shared. The partner will see this package for 90 days unless you withdraw it." };
}

export async function withdrawPackage(formData: FormData) {
  const { businessId, id } = z.object({ businessId: z.uuid(), id: z.uuid() }).parse(Object.fromEntries(formData));
  const { supabase } = await requireBusiness(businessId, ["owner"]);
  await supabase.rpc("withdraw_evidence_package", { p_package_id: id });
  revalidatePath(`/b/${businessId}/finance`);
}
