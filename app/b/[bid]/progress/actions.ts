"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireBusiness } from "@/lib/auth/guards";
import { fail, friendlyDbError, type ActionState } from "@/lib/actions";
import { METRICS, type MetricKey } from "@/lib/interventions/catalog";
import { createAdminClient } from "@/lib/supabase/admin";
import { runQueuedNow } from "@/lib/jobs/runner";

const metricKeys = Object.keys(METRICS) as [MetricKey, ...MetricKey[]];

export async function startPlan(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z.object({
    businessId: z.uuid(), title: z.string().trim().min(3).max(160), metric: z.enum(metricKeys),
    windowDays: z.coerce.number().int().min(1).max(180), sourceActionId: z.uuid().optional(), solutionVersionId: z.uuid().optional(),
  }).safeParse(Object.fromEntries([...formData.entries()].filter(([, v]) => v !== "")));
  if (!parsed.success) return fail("Please check the plan details.");
  const p = parsed.data;
  const { supabase } = await requireBusiness(p.businessId);
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
