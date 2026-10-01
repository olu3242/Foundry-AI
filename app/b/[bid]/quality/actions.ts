"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireBusiness, WRITER_ROLES } from "@/lib/auth/guards";
import { toMinor } from "@/lib/money";

export async function scanQuality(formData: FormData) {
  const { businessId } = z.object({ businessId: z.uuid() }).parse(Object.fromEntries(formData));
  const { supabase } = await requireBusiness(businessId, WRITER_ROLES);
  await supabase.rpc("scan_data_quality", { p_business_id: businessId });
  revalidatePath(`/b/${businessId}/quality`);
}

export async function resolveIssue(formData: FormData) {
  const f = z.object({
    businessId: z.uuid(), id: z.uuid(), action: z.enum(["void_duplicate", "not_duplicate", "explain_gap", "adjust_stock", "dismiss"]),
    recordId: z.uuid().optional(), reason: z.string().max(20).optional(), counted: z.coerce.number().min(0).optional(), note: z.string().max(300).optional(),
  }).parse(Object.fromEntries(formData));
  const { supabase } = await requireBusiness(f.businessId, WRITER_ROLES);
  const params = f.action === "void_duplicate" ? { record_id: f.recordId } : f.action === "explain_gap" ? { reason: f.reason ?? "other" }
    : f.action === "adjust_stock" ? { counted: f.counted } : {};
  await supabase.rpc("resolve_quality_issue", { p_issue_id: f.id, p_action: f.action, p_params: params, p_note: f.note || undefined });
  revalidatePath(`/b/${f.businessId}/quality`);
}

export async function correctRecord(formData: FormData) {
  const f = z.object({ businessId: z.uuid(), kind: z.enum(["sale", "expense"]), id: z.uuid(), amount: z.coerce.number().positive(), reason: z.string().trim().min(3).max(200) })
    .parse(Object.fromEntries(formData));
  const { business, supabase } = await requireBusiness(f.businessId, WRITER_ROLES);
  const minor = toMinor(f.amount, business.currency);
  await supabase.rpc("correct_record", { p_kind: f.kind, p_id: f.id, p_fields: f.kind === "sale" ? { total_minor: minor, amount_paid_minor: minor } : { amount_minor: minor }, p_reason: f.reason });
  revalidatePath(`/b/${f.businessId}/records`);
  revalidatePath(`/b/${f.businessId}/quality`);
}
