"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/database.types";

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
  const { error } = await supabase.rpc("upsert_market", { p_market: {
    country_code: f.country_code, name: f.name, currency: f.currency, default_timezone: f.default_timezone, default_locale: f.default_locale || "en",
    languages: list(f.languages), phone_prefix: f.phone_prefix, identifier_types: identifierTypes,
    connectors: { mobile_money: list(f.mobile_money) }, data_residency: f.data_residency || "any", status: f.status || "beta",
  } });
  if (error) return { ok: false as const, error: error.message };
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
  if (f.data.activate && data) await supabase.rpc("activate_policy", { p_policy_id: data });
  revalidatePath("/admin/policies");
  return { ok: true as const, message: f.data.activate ? "Saved and activated." : "Saved as draft." };
}

export async function activatePolicy(formData: FormData) {
  const { id, op } = z.object({ id: z.uuid(), op: z.enum(["activate", "retire"]) }).parse(Object.fromEntries(formData));
  await requireUser("/admin");
  const supabase = await createClient();
  await supabase.rpc(op === "activate" ? "activate_policy" : "retire_policy", { p_policy_id: id });
  revalidatePath("/admin/policies");
}
