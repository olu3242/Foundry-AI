"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";
import { fail, friendlyDbError, type ActionState } from "@/lib/actions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createRefund } from "@/lib/payments/paystack";

// B41: when dual approval is on, a sensitive change becomes a change request for a second admin.
type Supa = Awaited<ReturnType<typeof createClient>>;
async function orRequest(supabase: Supa, error: { message: string } | null, kind: string, target: string, payload: Json, reason: string) {
  if (!error?.message.startsWith("This change needs a second approver")) return { error };
  const { error: reqError } = await supabase.rpc("request_change", { p_kind: kind, p_target: target, p_payload: payload, p_reason: reason });
  revalidatePath("/admin/changes");
  return { error: reqError, requested: !reqError };
}

export async function deprecateVersion(formData: FormData) {
  const { versionId, reason } = z.object({ versionId: z.uuid(), reason: z.string().trim().min(3).max(300) }).parse(Object.fromEntries(formData));
  await requireUser("/admin");
  const supabase = await createClient();
  await supabase.rpc("deprecate_solution_version", { p_version_id: versionId, p_reason: reason });
  revalidatePath("/admin/solutions");
}

export async function reviewProvider(formData: FormData) {
  const { id, status } = z.object({ id: z.uuid(), status: z.enum(["approved", "suspended"]) }).parse(Object.fromEntries(formData));
  await requireUser("/admin");
  const supabase = await createClient();
  await supabase.rpc("review_provider", { p_provider_id: id, p_status: status });
  revalidatePath("/admin/solutions");
}

export async function reviewSolution(formData: FormData) {
  const { id, decision, note } = z.object({ id: z.uuid(), decision: z.enum(["active", "rejected"]), note: z.string().max(500).optional() }).parse(Object.fromEntries(formData));
  await requireUser("/admin");
  const supabase = await createClient();
  await supabase.rpc("review_solution", { p_solution_id: id, p_decision: decision, p_note: note || undefined });
  revalidatePath("/admin/solutions");
}

export async function saveMarket(_: unknown, formData: FormData) {
  await requireUser("/admin");
  const f = Object.fromEntries(formData) as Record<string, string>;
  const list = (v?: string) => (v ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  let identifierTypes: Json = [];
  try {
    identifierTypes = f.identifier_types ? (JSON.parse(f.identifier_types) as Json) : [];
  } catch {
    return { ok: false as const, error: "Identifier types must be JSON, e.g. [{\"key\":\"ursb\",\"label\":\"URSB\",\"pattern\":\"^[0-9]{6,14}$\"}]" };
  }
  const supabase = await createClient();
  const market = {
    country_code: f.country_code, name: f.name, currency: f.currency, default_timezone: f.default_timezone, default_locale: f.default_locale || "en",
    languages: list(f.languages), phone_prefix: f.phone_prefix, identifier_types: identifierTypes,
    connectors: { mobile_money: list(f.mobile_money) }, data_residency: f.data_residency || "any", status: f.status || "beta",
  };
  const first = await supabase.rpc("upsert_market", { p_market: market });
  const { error, requested } = await orRequest(supabase, first.error, "market_upsert", String(f.country_code), market, `Market ${f.name}`);
  if (error) return { ok: false as const, error: error.message };
  if (requested) return { ok: true as const, message: "Submitted for a second admin's approval." };
  revalidatePath("/admin/markets");
  return { ok: true as const, message: `Saved ${f.name}.` };
}

export async function addCost(_: unknown, formData: FormData) {
  await requireUser("/admin");
  const p = z.object({ month: z.string().regex(/^\d{4}-\d{2}$/), category: z.enum(["infrastructure", "operator", "other"]),
    amount: z.coerce.number().min(0), note: z.string().max(200).optional() }).safeParse(Object.fromEntries(formData));
  if (!p.success) return { ok: false as const, error: "Please check the cost entry." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_cost_input", { p_month: `${p.data.month}-01`, p_category: p.data.category, p_amount_usd: p.data.amount, p_note: p.data.note });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/admin/scale");
  return { ok: true as const, message: "Cost recorded." };
}

// ─── B21 commercial ───────────────────────────────────────────────────────────
export async function rateBilling() {
  await requireUser("/admin");
  const supabase = await createClient();
  await supabase.rpc("rate_billing", {});
  revalidatePath("/admin/commercial");
}

export async function settleCharge(formData: FormData) {
  const { id, method, reference } = z.object({
    id: z.uuid(), method: z.enum(["mobile_money", "bank_transfer", "cash", "card", "stripe"]), reference: z.string().trim().min(3).max(120),
  }).parse(Object.fromEntries(formData));
  await requireUser("/admin");
  const supabase = await createClient();
  await supabase.rpc("settle_billable_event", { p_id: id, p_method: method, p_reference: reference });
  revalidatePath("/admin/commercial");
}

export async function scanRetention() {
  await requireUser("/admin");
  const supabase = await createClient();
  await supabase.rpc("scan_retention");
  revalidatePath("/admin/retention");
}

export async function runRoutineOps() {
  await requireUser("/admin");
  const supabase = await createClient();
  await supabase.rpc("run_routine_ops", {});
  revalidatePath("/admin/retention");
}

// ─── B24 trust ────────────────────────────────────────────────────────────────
export async function reviewVerifier(formData: FormData) {
  const { id, status } = z.object({ id: z.uuid(), status: z.enum(["approved", "suspended"]) }).parse(Object.fromEntries(formData));
  await requireUser("/admin");
  const supabase = await createClient();
  await supabase.rpc("review_verifier", { p_verifier_id: id, p_status: status });
  revalidatePath("/admin/trust");
}

export async function resolveDispute(formData: FormData) {
  const { id, decision, resolution } = z.object({ id: z.uuid(), decision: z.enum(["upheld", "rejected"]), resolution: z.string().trim().min(3).max(1000) }).parse(Object.fromEntries(formData));
  await requireUser("/admin");
  const supabase = await createClient();
  await supabase.rpc("resolve_dispute", { p_dispute_id: id, p_decision: decision, p_resolution: resolution });
  revalidatePath("/admin/trust");
}

// ─── B28 policies ─────────────────────────────────────────────────────────────
export async function savePolicy(_: unknown, formData: FormData) {
  await requireUser("/admin");
  const f = z.object({
    key: z.enum(["finance.evidence_share", "solution.start", "ai.autonomy", "escalation.record_requests", "partner.verify_outcome"]),
    scopeType: z.enum(["global", "market", "program", "provider", "solution"]), scopeId: z.string().max(64).optional(),
    definition: z.string().max(10_000), note: z.string().max(300).optional(), activate: z.literal("on").optional(),
  }).safeParse(Object.fromEntries(formData));
  if (!f.success) return { ok: false as const, error: "Choose a policy key and scope." };
  let definition: Json;
  try {
    definition = JSON.parse(f.data.definition) as Json;
  } catch {
    return { ok: false as const, error: "The definition must be valid JSON." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_policy", { p_key: f.data.key, p_scope_type: f.data.scopeType, p_scope_id: f.data.scopeId ?? "", p_definition: definition, p_note: f.data.note || undefined });
  if (error) return { ok: false as const, error: error.message };
  if (f.data.activate && data) {
    const act = await supabase.rpc("activate_policy", { p_policy_id: data });
    const { error: actError, requested } = await orRequest(supabase, act.error, "policy_activation", data, {}, f.data.note || `Activate ${f.data.key}`);
    if (actError) return { ok: false as const, error: actError.message };
    revalidatePath("/admin/policies");
    if (requested) return { ok: true as const, message: "Saved. Activation submitted for a second admin's approval." };
  }
  revalidatePath("/admin/policies");
  return { ok: true as const, message: f.data.activate ? "Saved and activated." : "Saved as draft." };
}

export async function activatePolicy(formData: FormData) {
  const { id, op } = z.object({ id: z.uuid(), op: z.enum(["activate", "retire"]) }).parse(Object.fromEntries(formData));
  await requireUser("/admin");
  const supabase = await createClient();
  const r = await supabase.rpc(op === "activate" ? "activate_policy" : "retire_policy", { p_policy_id: id });
  if (op === "activate") await orRequest(supabase, r.error, "policy_activation", id, {}, "Activate policy version");
  revalidatePath("/admin/policies");
}

// ─── B29 experiments ──────────────────────────────────────────────────────────
export async function publishVariant(formData: FormData) {
  const { solutionId, steps } = z.object({ solutionId: z.uuid(), steps: z.string().trim().min(3).max(4000) }).parse(Object.fromEntries(formData));
  await requireUser("/admin");
  const supabase = await createClient();
  await supabase.rpc("publish_solution_version", { p_solution_id: solutionId, p_playbook: steps.split("\n").map((s) => s.trim()).filter(Boolean) });
  revalidatePath("/admin/experiments");
}

export async function createExperiment(_: unknown, formData: FormData) {
  await requireUser("/admin");
  const f = z.object({
    key: z.string().regex(/^[a-z0-9_]{3,60}$/), name: z.string().trim().min(3).max(120), hypothesis: z.string().trim().min(10).max(1000),
    solutionId: z.uuid(), control: z.uuid(), treatment: z.uuid(), controlWeight: z.coerce.number().int().min(0).max(100),
    metric: z.enum(["improved_rate", "completion_rate"]), minPerArm: z.coerce.number().int().min(5).max(10000),
    maxDays: z.coerce.number().int().min(7).max(365), abandonMax: z.coerce.number().min(0).max(1),
  }).safeParse(Object.fromEntries(formData));
  if (!f.success) return { ok: false as const, error: "Check the experiment fields (key: lowercase letters, digits, underscores)." };
  const d = f.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_experiment", {
    p_key: d.key, p_name: d.name, p_hypothesis: d.hypothesis, p_surface: "solution_variant", p_solution_id: d.solutionId,
    p_arms: [{ key: "control", weight: d.controlWeight, solution_version_id: d.control }, { key: "treatment", weight: 100 - d.controlWeight, solution_version_id: d.treatment }],
    p_primary_metric: d.metric, p_min_per_arm: d.minPerArm, p_max_duration_days: d.maxDays, p_guardrails: [{ metric: "abandon_rate", max: d.abandonMax }],
  });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/admin/experiments");
  return { ok: true as const, message: "Created as a draft." };
}

export async function setExperimentStatus(formData: FormData) {
  const { id, status } = z.object({ id: z.uuid(), status: z.enum(["running", "stopped"]) }).parse(Object.fromEntries(formData));
  await requireUser("/admin");
  const supabase = await createClient();
  await supabase.rpc("set_experiment_status", { p_id: id, p_status: status });
  revalidatePath("/admin/experiments");
}

export async function evaluateExperiments() {
  await requireUser("/admin");
  const supabase = await createClient();
  await supabase.rpc("evaluate_experiments");
  revalidatePath("/admin/experiments");
}

// ─── B30 control plane ────────────────────────────────────────────────────────
export async function detectIncidents() {
  await requireUser("/admin");
  const supabase = await createClient();
  await supabase.rpc("detect_incidents");
  revalidatePath("/admin/control");
}

export async function acknowledgeIncident(formData: FormData) {
  const { id } = z.object({ id: z.uuid() }).parse(Object.fromEntries(formData));
  await requireUser("/admin");
  const supabase = await createClient();
  await supabase.rpc("acknowledge_incident", { p_id: id });
  revalidatePath("/admin/control");
}

// ─── B31 vertical packs ───────────────────────────────────────────────────────
export async function savePack(_: unknown, formData: FormData) {
  await requireUser("/admin");
  const f = z.object({ key: z.string().regex(/^[a-z_]{3,40}$/), name: z.string().trim().min(3).max(120), definition: z.string().max(50_000) })
    .safeParse(Object.fromEntries(formData));
  if (!f.success) return { ok: false as const, error: "Key (lowercase/underscores), name and definition are required." };
  let definition: Json;
  try {
    definition = JSON.parse(f.data.definition) as Json;
  } catch {
    return { ok: false as const, error: "The definition must be valid JSON." };
  }
  const supabase = await createClient();
  const first = await supabase.rpc("upsert_pack", { p_key: f.data.key, p_name: f.data.name, p_definition: definition });
  const { error, requested } = await orRequest(supabase, first.error, "pack_upsert", f.data.key, { name: f.data.name, definition }, `Pack ${f.data.name}`);
  if (error) return { ok: false as const, error: error.message };
  if (requested) return { ok: true as const, message: "Submitted for a second admin's approval." };
  revalidatePath("/admin/packs");
  return { ok: true as const, message: "Pack saved. Businesses can turn it on in Settings." };
}

// ─── B35 channel economics ────────────────────────────────────────────────────
export async function addChannelCost(_: unknown, formData: FormData) {
  await requireUser("/admin");
  const f = z.object({ channel: z.enum(["partner_invite", "program_invite", "program_code", "organic"]), month: z.string().regex(/^\d{4}-\d{2}$/),
    amount: z.coerce.number().min(0), note: z.string().trim().min(3).max(300) }).safeParse(Object.fromEntries(formData));
  if (!f.success) return { ok: false as const, error: "Channel, month, amount and what the money was for are required." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_channel_cost", { p_channel: f.data.channel, p_month: `${f.data.month}-01`, p_amount_usd: f.data.amount, p_note: f.data.note });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/admin/channels");
  return { ok: true as const, message: "Recorded." };
}

// ─── B37 data layer ───────────────────────────────────────────────────────────
export async function buildDataset(formData: FormData) {
  const { key } = z.object({ key: z.string().regex(/^[a-z_]+$/) }).parse(Object.fromEntries(formData));
  await requireUser("/admin");
  const supabase = await createClient();
  await supabase.rpc("build_dataset", { p_key: key });
  revalidatePath("/admin/data");
}

// ─── B41 approvals and job failures ───────────────────────────────────────────
export async function decideChange(formData: FormData) {
  const { id, decision, note } = z.object({ id: z.uuid(), decision: z.enum(["approve", "reject"]), note: z.string().max(500).optional() }).parse(Object.fromEntries(formData));
  await requireUser("/admin");
  const supabase = await createClient();
  await supabase.rpc("decide_change", { p_id: id, p_approve: decision === "approve", p_note: note || undefined });
  revalidatePath("/admin/changes");
}

export async function requeueJob(formData: FormData) {
  const { id } = z.object({ id: z.uuid() }).parse(Object.fromEntries(formData));
  await requireUser("/admin");
  const supabase = await createClient();
  await supabase.rpc("requeue_job", { p_job_id: id });
  revalidatePath("/admin/jobs");
}

// ─── B43 payments ─────────────────────────────────────────────────────────────
export async function refundPayment(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z.object({ id: z.uuid(), amount: z.coerce.number().int().positive(), reason: z.string().trim().min(5).max(300) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Enter the amount (minor units) and a reason.");
  await requireUser("/admin");
  const supabase = await createClient();
  const { data: refundId, error } = await supabase.rpc("request_payment_refund", { p_payment_request_id: parsed.data.id, p_amount_minor: parsed.data.amount, p_reason: parsed.data.reason });
  if (error) return fail(friendlyDbError(error));
  const admin = createAdminClient();
  const { data: pr } = await admin.from("payment_requests").select("provider_transaction_id").eq("id", parsed.data.id).single();
  try {
    const refund = await createRefund(pr!.provider_transaction_id!, parsed.data.amount);
    await admin.rpc("record_refund_submission", { p_refund_id: refundId as string, p_provider_refund_id: String(refund.id), p_error: "" });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await admin.rpc("record_refund_submission", { p_refund_id: refundId as string, p_provider_refund_id: "", p_error: message });
    return fail(`The provider refused the refund: ${message}`);
  }
  revalidatePath("/admin/payments");
  return { ok: true, message: "Refund submitted. Revenue is reversed when the provider confirms it." };
}
