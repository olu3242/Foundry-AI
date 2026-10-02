import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { withSpan } from "@/lib/telemetry";
import { enqueue } from "@/lib/jobs/queue";

export const dynamic = "force-dynamic";

/** Daily: purge expired ops state and schedule per-business recomputes. */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const result = await withSpan("cron.maintenance", {}, async () => {
    const admin = createAdminClient();
    const { data: purged, error } = await admin.rpc("purge_expired_ops");
    if (error) throw error;
    // Daily Pulse for every active business (trends move even on days with no new records).
    const { data: businesses } = await admin.from("businesses").select("id").is("archived_at", null);
    const day = new Date().toISOString().slice(0, 10);
    for (const b of businesses ?? []) {
      await enqueue("pulse.compute", {
        businessId: b.id,
        dedupeKey: `pulse:${b.id}`,
        payload: { day },
        flow: {
          flow_type: "business.daily_intelligence",
          triggered_by: "cron.maintenance",
          authority_mode: "auto",
          approval_required: false,
          evidence_required: true,
          capability: { kind: "internal.compute", action: "pulse.compute" },
          metadata: { day },
        },
      });
    }
    await enqueue("fx.refresh", { dedupeKey: `fx:${day}` });
    await enqueue("evidence.harvest", { dedupeKey: `evidence:${day}`, runAt: new Date(Date.now() + 70 * 60_000) });
    await enqueue("pilots.advance", { dedupeKey: `pilots:${day}`, runAt: new Date(Date.now() + 55 * 60_000) });
    await enqueue("metrics.rollup", { dedupeKey: `metrics:${day}`, runAt: new Date(Date.now() + 30 * 60_000) });
    await enqueue("learning.snapshot", { dedupeKey: `learning:${day}`, runAt: new Date(Date.now() + 20 * 60_000) });
    await enqueue("ops.routine", { dedupeKey: `ops:${day}`, runAt: new Date(Date.now() + 10 * 60_000) });
    await enqueue("forecast.compute", { dedupeKey: `forecast:${day}`, runAt: new Date(Date.now() + 35 * 60_000) });
    await enqueue("experiments.evaluate", { dedupeKey: `experiments:${day}`, runAt: new Date(Date.now() + 40 * 60_000) });
    await enqueue("incidents.detect", { dedupeKey: `incidents:${day}`, runAt: new Date(Date.now() + 45 * 60_000) });
    await enqueue("packs.workflows", {
      dedupeKey: `packs:${day}`,
      runAt: new Date(Date.now() + 12 * 60_000),
      flow: {
        flow_type: "business.pack_workflows",
        triggered_by: "cron.maintenance",
        authority_mode: "auto",
        approval_required: false,
        evidence_required: true,
        capability: { kind: "workflow.engine", action: "packs.workflows" },
        metadata: { day },
      },
    });
    await enqueue("datasets.build", { dedupeKey: `datasets:${day}`, runAt: new Date(Date.now() + 50 * 60_000) });
    await enqueue("quality.scan", { dedupeKey: `quality:${day}`, runAt: new Date(Date.now() + 5 * 60_000) });
    await enqueue("retention.scan", { dedupeKey: `retention:${day}`, runAt: new Date(Date.now() + 25 * 60_000) });
    await enqueue("benchmarks.compute", { dedupeKey: `benchmarks:${day}`, runAt: new Date(Date.now() + 15 * 60_000) });
    return { purged, pulse_enqueued: businesses?.length ?? 0 };
  });
  return NextResponse.json(result);
}
