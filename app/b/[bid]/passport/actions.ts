"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireBusiness, WRITER_ROLES } from "@/lib/auth/guards";
import { fail, friendlyDbError, type ActionState } from "@/lib/actions";
import { newShareToken } from "@/lib/passport/token";
import { PASSPORT_SECTIONS } from "@/lib/passport/facts";
import { enforceRateLimit, LIMITS, RateLimitError } from "@/lib/rate-limit";
import { publicEnv } from "@/lib/env";

const shareSchema = z.object({
  businessId: z.uuid(),
  label: z.string().trim().min(2, "Say who this is for").max(80),
  days: z.coerce.number().int().refine((d) => [7, 30, 90].includes(d)),
  sections: z.array(z.enum(PASSPORT_SECTIONS)).min(1, "Choose at least one section"),
});

export async function createShare(_: ActionState, formData: FormData): Promise<ActionState<{ url: string }>> {
  const parsed = shareSchema.safeParse({
    businessId: formData.get("businessId"), label: formData.get("label"), days: formData.get("days"), sections: formData.getAll("sections"),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Please check the form.");
  const { businessId, label, days, sections } = parsed.data;
  const { user, supabase } = await requireBusiness(businessId, ["owner"]);
  try {
    await enforceRateLimit(`share:${user.id}`, LIMITS.shareCreate);
  } catch (e) {
    if (e instanceof RateLimitError) return fail(e.message);
    throw e;
  }
  const { token, hash } = newShareToken();
  const { error } = await supabase.from("passport_shares").insert({
    business_id: businessId, token_hash: hash, label, sections, expires_at: new Date(Date.now() + days * 86_400_000).toISOString(),
  });
  if (error) return fail(friendlyDbError(error));
  revalidatePath(`/b/${businessId}/passport`);
  return { ok: true, data: { url: new URL(`/p/${token}`, publicEnv.NEXT_PUBLIC_SITE_URL).toString() }, message: "Link created. Copy it now: it won't be shown again." };
}

export async function revokeShare(formData: FormData) {
  const businessId = z.uuid().parse(formData.get("businessId"));
  const shareId = z.uuid().parse(formData.get("shareId"));
  const { supabase } = await requireBusiness(businessId, ["owner"]);
  await supabase.from("passport_shares").update({ revoked_at: new Date().toISOString() }).eq("id", shareId).eq("business_id", businessId);
  revalidatePath(`/b/${businessId}/passport`);
}

const DOC_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const proofSchema = z.object({
  businessId: z.uuid(),
  method: z.enum(["receipt", "invoice", "bank_statement", "mobile_money_statement", "registration_certificate", "tax_certificate", "other"]),
  period_start: z.iso.date().optional().or(z.literal("").transform(() => undefined)),
  period_end: z.iso.date().optional().or(z.literal("").transform(() => undefined)),
  note: z.string().trim().max(500).optional(),
});

export async function addProof(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = proofSchema.safeParse(Object.fromEntries([...formData.entries()].filter(([, v]) => typeof v === "string")));
  if (!parsed.success) return fail("Please check the form.");
  const { businessId, method, period_start, period_end, note } = parsed.data;
  if ((period_start && !period_end) || (!period_start && period_end)) return fail("Give both a start and an end date, or neither.");
  const { supabase } = await requireBusiness(businessId, WRITER_ROLES);

  const file = formData.get("document");
  if (!(file instanceof File) || file.size === 0) return fail("Attach the document.");
  if (!DOC_TYPES.includes(file.type)) return fail("Use a PDF or a photo.");
  if (file.size > 10 * 1024 * 1024) return fail("That file is over 10 MB.");
  const path = `${businessId}/${randomUUID()}.${file.type === "application/pdf" ? "pdf" : file.type.split("/")[1]}`;
  const { error: uploadError } = await supabase.storage.from("evidence").upload(path, file, { contentType: file.type });
  if (uploadError) return fail("Upload failed. Check your connection and try again.");

  const { error } = await supabase.rpc("add_verification", {
    p_business_id: businessId, p_subject_type: "business", p_level: "document_backed", p_method: method,
    p_note: note || undefined, p_evidence_path: path, p_period_start: period_start, p_period_end: period_end,
  });
  if (error) return fail(friendlyDbError(error));
  revalidatePath(`/b/${businessId}/passport`);
  return { ok: true, message: "Proof added to your Passport." };
}

export async function vouch(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z.object({
    businessId: z.uuid(), method: z.enum(["site_visit", "program_review"]), note: z.string().trim().max(500).optional(),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Please check the form.");
  const { businessId, method, note } = parsed.data;
  const { role, supabase } = await requireBusiness(businessId, ["partner", "program_admin"]);
  const { error } = await supabase.rpc("add_verification", {
    p_business_id: businessId, p_subject_type: "business", p_method: method, p_note: note || undefined,
    p_level: method === "program_review" && role === "program_admin" ? "institution_verified" : "third_party_verified",
  });
  if (error) return fail(friendlyDbError(error));
  revalidatePath(`/b/${businessId}/passport`);
  return { ok: true, message: "Verification recorded." };
}

// ─── B24 trust network ────────────────────────────────────────────────────────
export async function requestVerification(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z.object({
    businessId: z.uuid(), verifierId: z.uuid(), claimType: z.enum(["sales_total_period", "registration"]),
    months: z.coerce.number().int().min(1).max(12).default(3), identifierType: z.string().max(40).optional(), consent: z.literal("on"),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Choose a verifier and what to check, and tick the consent box.");
  const p = parsed.data;
  const { supabase } = await requireBusiness(p.businessId, ["owner"]);
  const end = new Date();
  const start = new Date(end);
  start.setMonth(start.getMonth() - p.months);
  const params = p.claimType === "sales_total_period"
    ? { period_start: start.toISOString().slice(0, 10), period_end: end.toISOString().slice(0, 10) }
    : { type: p.identifierType ?? "" };
  const { error } = await supabase.rpc("request_verification", {
    p_business_id: p.businessId, p_verifier_id: p.verifierId, p_claim_type: p.claimType, p_params: params, p_consent: true,
  });
  if (error) return fail(friendlyDbError(error));
  revalidatePath(`/b/${p.businessId}/passport`);
  return { ok: true, message: "Sent. The verifier sees only the records listed for this claim, for 30 days." };
}

export async function disputeAttestation(formData: FormData) {
  const { businessId, id, reason } = z.object({ businessId: z.uuid(), id: z.uuid(), reason: z.string().trim().min(5).max(1000) }).parse(Object.fromEntries(formData));
  const { supabase } = await requireBusiness(businessId, ["owner"]);
  await supabase.rpc("dispute_attestation", { p_attestation_id: id, p_reason: reason });
  revalidatePath(`/b/${businessId}/passport`);
}
