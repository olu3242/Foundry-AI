import "server-only";
import { PermanentJobError, type JobHandler } from "@/lib/jobs/types";
import type { Json } from "@/lib/supabase/database.types";
import { isImprovement } from "./catalog";

/** B11: snapshot a business's metrics and Pulse when it joins a program. */
export const baselineJob: JobHandler = async ({ job, admin }) => {
  const bid = job.business_id;
  const programId = (job.payload as { program_id?: string }).program_id ?? null;
  if (!bid) throw new PermanentJobError("business_id required");
  const [{ data: metrics, error }, { data: latest }] = await Promise.all([
    admin.rpc("pulse_metrics", { p_business_id: bid }),
    admin.from("pulse_snapshots").select("dimension, state, score, computed_on").eq("business_id", bid).order("computed_on", { ascending: false }).limit(9),
  ]);
  if (error) throw error;
  const { error: upsertError } = await admin.from("business_baselines").upsert(
    { business_id: bid, program_id: programId, metrics: metrics as { [k: string]: Json }, pulse: (latest ?? []) as Json[], captured_at: new Date().toISOString() },
    { onConflict: "business_id,program_id" },
  );
  if (upsertError) throw upsertError;
  return { ok: true };
};

/** B11: compare the plan's metric now against its baseline. Observation only; verification is a person's call. */
export const measureOutcomeJob: JobHandler = async ({ job, admin }) => {
  const iid = (job.payload as { intervention_id?: string }).intervention_id;
  const { data: i } = await admin.from("interventions").select("*").eq("id", iid ?? "").maybeSingle();
  if (!i) throw new PermanentJobError("intervention not found");
  if (i.status !== "completed") return { skipped: i.status };
  const { data: metrics, error } = await admin.rpc("pulse_metrics", { p_business_id: i.business_id });
  if (error) throw error;
  const m = metrics as Record<string, number>;
  // B31: vertical pack metrics are measured by the configured pack engine.
  let observed = Number(m[i.target_metric] ?? 0);
  if (i.target_metric.startsWith("pack:")) {
    const { data: v, error: e } = await admin.rpc("measure_metric", { p_business_id: i.business_id, p_metric: i.target_metric });
    if (e) throw e;
    observed = Number(v ?? 0);
  }
  const baseline = Number(i.baseline_value);
  const delta = observed - baseline;
  const { error: upsertError } = await admin.from("outcomes").upsert({
    intervention_id: i.id, business_id: i.business_id, metric: i.target_metric,
    baseline_value: baseline, observed_value: observed, delta, improved: isImprovement(i.target_metric, delta, i.expected_direction),
    window_start: i.started_at, window_end: new Date().toISOString(),
    evidence: { records_30: m.records_30, records_verified_30: m.records_verified_30, records_captured_30: m.records_captured_30, active_days_30: m.active_days_30 },
  }, { onConflict: "intervention_id" });
  if (upsertError) throw upsertError;
  await admin.from("events").insert({ business_id: i.business_id, type: "outcome.observed", actor_type: "system", entity_type: "intervention", entity_id: i.id,
    payload: { metric: i.target_metric, delta, improved: isImprovement(i.target_metric, delta, i.expected_direction) } });
  return { delta };
};
