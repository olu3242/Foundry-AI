"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { fail, friendlyDbError, type ActionState } from "@/lib/actions";

const METRICS = ["activation_rate", "recording_rate", "intervention_rate", "verified_outcomes", "improved_outcome_rate", "retention_rate"] as const;

export async function createPilot(_: ActionState, formData: FormData): Promise<ActionState> {
  const f = Object.fromEntries(formData) as Record<string, string>;
  const parsed = z.object({
    name: z.string().trim().min(3).max(120), join_code: z.string().trim().min(4).max(20), country_code: z.string().regex(/^([A-Z]{2})?$/),
    sector: z.string().trim().max(60), target_size: z.coerce.number().int().min(1).max(100000),
    starts_on: z.iso.date(), ends_on: z.iso.date(), escalation_days: z.coerce.number().int().min(1).max(60),
  }).safeParse(f);
  if (!parsed.success) return fail("Check the pilot fields: name, program code, size and dates are required.");
  const success_metrics = METRICS.filter((m) => f[`metric_${m}`]).map((m) => ({ key: m, target: Number(f[`metric_${m}`]) }));
  if (success_metrics.some((m) => !Number.isFinite(m.target))) return fail("Success targets must be numbers.");
  const checkpoints = (f.checkpoints ?? "").split(",").map((c) => c.trim()).filter(Boolean).map((c) => {
    const [day, ...label] = c.split(":");
    return { day: Number(day), label: label.join(":").trim() };
  });
  if (checkpoints.some((c) => !Number.isInteger(c.day) || !c.label)) return fail("Checkpoints look like 0:Kick-off, 30:Mid-point review");
  await requireUser("/pilots");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_pilot", { p_config: { ...parsed.data, success_metrics, checkpoints } });
  if (error) return fail(friendlyDbError(error));
  redirect(`/pilots/${data}`);
}

async function pilotCall(id: string, fn: (s: Awaited<ReturnType<typeof createClient>>) => PromiseLike<{ error: { code?: string; message: string } | null }>, message = "Done."): Promise<ActionState> {
  await requireUser(`/pilots/${id}`);
  const { error } = await fn(await createClient());
  if (error) return fail(friendlyDbError(error));
  revalidatePath(`/pilots/${id}`);
  return { ok: true, message };
}

export async function setPilotStatus(formData: FormData) {
  const { id, status } = z.object({ id: z.uuid(), status: z.enum(["active", "completed", "cancelled"]) }).parse(Object.fromEntries(formData));
  await pilotCall(id, (s) => s.rpc("save_pilot", { p_config: { id, status } }));
}

export async function advancePilots(formData: FormData) {
  const { id } = z.object({ id: z.uuid() }).parse(Object.fromEntries(formData));
  await pilotCall(id, (s) => s.rpc("advance_pilots"));
}

export async function invitePhones(_: ActionState, formData: FormData): Promise<ActionState> {
  const { id, phones } = z.object({ id: z.uuid(), phones: z.string().min(8).max(20000) }).parse(Object.fromEntries(formData));
  return pilotCall(id, (s) => s.rpc("invite_to_pilot", { p_pilot_id: id, p_phones: phones.split(/[\s,;]+/).filter(Boolean) }), "Invites recorded.");
}

export async function addOperator(_: ActionState, formData: FormData): Promise<ActionState> {
  const { id, contact, role } = z.object({ id: z.uuid(), contact: z.string().trim().min(5), role: z.enum(["operator", "sponsor", "support"]) }).parse(Object.fromEntries(formData));
  return pilotCall(id, (s) => s.rpc("add_pilot_operator", { p_pilot_id: id, p_contact: contact, p_role: role }), "Added.");
}

// ─── B53 operator field OS ────────────────────────────────────────────────────
const TOUCH_KINDS = ["call", "visit", "message", "record_help", "confirmation", "pulse_review", "intervention_support", "verification", "escalation", "payment_help", "other"] as const;

export async function logTouch(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z.object({ id: z.uuid(), businessId: z.uuid(), kind: z.enum(TOUCH_KINDS), minutes: z.coerce.number().int().min(0).max(600), note: z.string().max(1000).optional() })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Choose what you did and how many minutes it took.");
  const { id, businessId, kind, minutes, note } = parsed.data;
  return pilotCall(id, (s) => s.rpc("log_operator_touch", { p_pilot_id: id, p_business_id: businessId, p_kind: kind, p_minutes: minutes, p_note: note || undefined }), "Logged.");
}

export async function ratePulse(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z.object({ id: z.uuid(), businessId: z.uuid(), dimension: z.string().min(3).max(40), verdict: z.enum(["accurate", "inaccurate", "unclear", "missed"]),
    action: z.string().max(300).optional(), result: z.string().max(300).optional() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Choose the Pulse area and your verdict.");
  const { id, businessId, dimension, verdict, action, result } = parsed.data;
  return pilotCall(id, (s) => s.rpc("give_operator_pulse_feedback", { p_business_id: businessId, p_dimension: dimension,
    p_computed_on: new Date().toISOString().slice(0, 10), p_verdict: verdict, p_action_taken: action || undefined, p_result: result || undefined }), "Pulse rated.");
}

export async function makeOffer(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z.object({ id: z.uuid(), businessId: z.uuid(), plan: z.string().regex(/^[a-z0-9_]{2,40}$/), payer: z.enum(["business", "sponsor", "institution", "partner"]),
    amount: z.coerce.number().int().min(0) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Choose the plan, who pays and the amount (minor units).");
  const { id, businessId, plan, payer, amount } = parsed.data;
  return pilotCall(id, (s) => s.rpc("make_offer", { p_business_id: businessId, p_pilot_id: id, p_offer_kind: "plan", p_payer_kind: payer, p_plan_key: plan, p_amount_minor: amount }), "Offer sent.");
}

// ─── Pilot gap loop ───────────────────────────────────────────────────────────
export async function recordGap(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z.object({ id: z.uuid(), batch: z.string().regex(/^B5[1-9]$|^B60$/), businessId: z.union([z.uuid(), z.literal("")]), problem: z.string().trim().min(5).max(500),
    severity: z.enum(["P0", "P1", "P2", "P3"]), evidence: z.string().trim().min(3).max(500) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Describe the problem, its severity and the evidence.");
  const g = parsed.data;
  return pilotCall(g.id, (s) => s.rpc("record_pilot_gap", { p_pilot_id: g.id, p_batch: g.batch, p_business_id: (g.businessId || null) as string,
    p_problem: g.problem, p_severity: g.severity, p_evidence: g.evidence }), "Gap recorded.");
}

export async function updateGap(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z.object({ id: z.uuid(), gapId: z.string().min(5), status: z.enum(["open", "in_progress", "resolved", "backlogged", "wont_fix"]),
    rootCause: z.string().max(500).optional(), action: z.string().max(500).optional(), resolution: z.string().max(500).optional() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Choose a status.");
  const g = parsed.data;
  return pilotCall(g.id, (s) => s.rpc("update_pilot_gap", { p_gap_id: g.gapId, p_status: g.status, p_root_cause: g.rootCause || undefined,
    p_action: g.action || undefined, p_resolution: g.resolution || undefined }), "Gap updated.");
}
