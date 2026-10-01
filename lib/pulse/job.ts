import "server-only";
import { PermanentJobError, type JobHandler } from "@/lib/jobs/types";
import { computePulse, type Metrics } from "./score";
import { enqueue } from "@/lib/jobs/queue";

export const computePulseJob: JobHandler = async ({ job, admin }) => {
  const businessId = job.business_id;
  if (!businessId) throw new PermanentJobError("business_id required");
  const { data: business } = await admin.from("businesses").select("currency, timezone").eq("id", businessId).maybeSingle();
  if (!business) throw new PermanentJobError("business not found");

  const now = new Date();
  const monthAgo = new Date(now.getTime() - 30 * 86_400_000);
  const [current, previous] = await Promise.all([
    admin.rpc("pulse_metrics", { p_business_id: businessId, p_as_of: now.toISOString() }),
    admin.rpc("pulse_metrics", { p_business_id: businessId, p_as_of: monthAgo.toISOString() }),
  ]);
  if (current.error) throw current.error;
  if (previous.error) throw previous.error;

  const prev = previous.data as Metrics;
  const results = computePulse(current.data as Metrics, prev.records_30 > 0 ? prev : null, business.currency);
  const computedOn = new Intl.DateTimeFormat("en-CA", { timeZone: business.timezone }).format(now);

  const { error } = await admin.from("pulse_snapshots").upsert(
    results.map((r) => ({ business_id: businessId, computed_on: computedOn, computed_at: now.toISOString(), ...r })),
    { onConflict: "business_id,computed_on,dimension" },
  );
  if (error) throw error;

  const attention = results.filter((r) => r.state === "at_risk" || r.state === "watch").map((r) => r.dimension);
  await admin.from("events").insert({
    business_id: businessId, type: "pulse.computed", actor_type: "system", entity_type: "pulse",
    payload: { attention, computed_on: computedOn },
  });
  // Downstream agents react to the fresh Pulse.
  await Promise.all([
    enqueue("growth.recommend", { businessId, dedupeKey: `growth:${businessId}` }),
    enqueue("market.match", { businessId, dedupeKey: `match-business:${businessId}` }),
  ]);
  return { computed_on: computedOn, attention };
};
