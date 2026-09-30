import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { withSpan } from "@/lib/telemetry";

export const dynamic = "force-dynamic";

/** Daily: purge expired ops state. Later batches schedule per-business recomputes here. */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const result = await withSpan("cron.maintenance", {}, async () => {
    const admin = createAdminClient();
    const { data: purged, error } = await admin.rpc("purge_expired_ops");
    if (error) throw error;
    return { purged };
  });
  return NextResponse.json(result);
}
