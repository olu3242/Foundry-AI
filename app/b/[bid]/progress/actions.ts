"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { policyDenial } from "@/lib/policy";
import { requireBusiness } from "@/lib/auth/guards";
import { fail, friendlyDbError, type ActionState } from "@/lib/actions";
import { METRICS, type MetricKey } from "@/lib/interventions/catalog";
import { createAdminClient } from "@/lib/supabase/admin";
import { runQueuedNow } from "@/lib/jobs/runner";

const metricKeys = Object.keys(METRICS) as [MetricKey, ...MetricKey[]];

export async function startPlan(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z.object({
    businessId: z.uuid(), title: z.string().trim().min(3).max(160), metric: z.union([z.enum(metricKeys), z.string().regex(/^pack:[a-z_]+:[a-z_]+$/)]),
    windowDays: z.coerce.number().int().min(1).max(180), sourceActionId: z.uuid().optional(), solutionVersionId: z.uuid().optional(),
  }).safeParse(Object.fromEntries([...formData.entries()].filter(([, v]) => v !== "")));
  if (!parsed.success) return fail("Please check the plan details.");
  const p = parsed.data;
  const { supabase } = await requireBusiness(p.businessId);
  if (p.solutionVersionId) {
    const denied = await policyDenial(supabase, "solution.start", p.businessId, { solution_version_id: p.solutionVersionId });
    if (denied) return fail(denied);
  }
  const { error } = await supabase.rpc("start_intervention", {
    p_business_id: p.businessId, p_title: p.title, p_metric: p.metric, p_window_days: p.windowDays,
    p_source_action_id: p.sourceActionId, p_solution_version_id: p.solutionVersionId,
  });
  if (error) return fail(friendlyDbError(error));
  revalidatePath(`/b/${p.businessId}`, "layout");
  return { ok: true, message: "Plan started. Foundry will measure the result when it ends." };
}

const idSchema = z.object({ businessId: z.uuid(), id: z.uuid() });

export async function completePlan(formData: FormData) {
  const { businessId, id } = idSchema.parse(Object.fromEntries(formData));
  const { supabase } = await requireBusiness(businessId);
  const { error } = await supabase.rpc("complete_intervention", { p_intervention_id: id });
  if (!error) {
    // Measure straight away when the window has already passed (the worker handles future windows).
    const { data: job } = await createAdminClient().from("jobs").select("id, run_at").eq("dedupe_key", `outcome:${id}`).eq("status", "queued").maybeSingle();
    if (job && new Date(job.run_at).getTime() <= Date.now()) await runQueuedNow(job.id);
  }
  revalidatePath(`/b/${businessId}`, "layout");
}

export async function abandonPlan(formData: FormData) {
  const { businessId, id, reason } = idSchema.extend({ reason: z.enum(["not_relevant", "too_hard", "no_time", "no_money", "did_not_work", "other"]) })
    .parse(Object.fromEntries(formData));
  const { supabase } = await requireBusiness(businessId);
  await supabase.rpc("abandon_intervention", { p_intervention_id: id, p_reason: reason });
  revalidatePath(`/b/${businessId}/progress`);
}

export async function verifyResult(formData: FormData) {
  const { businessId, id, verdict } = idSchema.extend({ verdict: z.enum(["verified", "disputed"]) }).parse(Object.fromEntries(formData));
  const { supabase } = await requireBusiness(businessId, ["partner", "program_admin"]);
  // Records the policy decision (a denial is then enforced by the outcomes trigger).
  if (verdict === "verified") await policyDenial(supabase, "partner.verify_outcome", businessId);
  await supabase.rpc("verify_outcome", { p_outcome_id: id, p_verdict: verdict });
  revalidatePath(`/b/${businessId}`, "layout");
}

export async function pulseFeedback(formData: FormData) {
  const { businessId, dimension, computedOn, verdict } = z.object({
    businessId: z.uuid(), dimension: z.string().max(40), computedOn: z.iso.date(), verdict: z.enum(["accurate", "inaccurate", "unclear"]),
  }).parse(Object.fromEntries(formData));
  const { supabase } = await requireBusiness(businessId);
  await supabase.rpc("give_pulse_feedback", { p_business_id: businessId, p_dimension: dimension, p_computed_on: computedOn, p_verdict: verdict });
  revalidatePath(`/b/${businessId}/pulse`);
}

export async function startProviderSolution(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z.object({ businessId: z.uuid(), versionId: z.uuid(), consent: z.literal("on") }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Tick the box to agree to work with this provider.");
  const { supabase } = await requireBusiness(parsed.data.businessId, ["owner", "staff"]);
  const denied = await policyDenial(supabase, "solution.start", parsed.data.businessId, { solution_version_id: parsed.data.versionId });
  if (denied) return fail(denied);
  const { error } = await supabase.rpc("start_provider_solution", { p_business_id: parsed.data.businessId, p_solution_version_id: parsed.data.versionId, p_consent: true });
  if (error) return fail(friendlyDbError(error));
  revalidatePath(`/b/${parsed.data.businessId}`, "layout");
  return { ok: true, message: "Started. The provider will be in touch." };
}

export async function businessUpdate(formData: FormData) {
  const { businessId, engagementId, note } = z.object({ businessId: z.uuid(), engagementId: z.uuid(), note: z.string().trim().min(2).max(1000) }).parse(Object.fromEntries(formData));
  const { supabase } = await requireBusiness(businessId, ["owner", "staff"]);
  await supabase.rpc("post_engagement_update", { p_engagement_id: engagementId, p_note: note });
  revalidatePath(`/b/${businessId}/progress`);
}

// B34: launch a multi-step playbook (each step is a normal, governed plan).
export async function launchPlaybook(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z.object({ businessId: z.uuid(), playbook: z.string().regex(/^[a-z_]{3,60}$/) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Choose a playbook.");
  const { supabase } = await requireBusiness(parsed.data.businessId, ["owner", "staff"]);
  const { error } = await supabase.rpc("launch_playbook", { p_business_id: parsed.data.businessId, p_playbook_key: parsed.data.playbook });
  if (error) return fail(friendlyDbError(error));
  revalidatePath(`/b/${parsed.data.businessId}`, "layout");
  return { ok: true, message: "Started. Step 1 is now one of your plans." };
}
