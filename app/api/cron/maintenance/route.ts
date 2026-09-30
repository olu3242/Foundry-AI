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
      await enqueue("pulse.compute", { businessId: b.id, dedupeKey: `pulse:${b.id}`, payload: { day } });
    }
    return { purged, pulse_enqueued: businesses?.length ?? 0 };
  });
  return NextResponse.json(result);
}
