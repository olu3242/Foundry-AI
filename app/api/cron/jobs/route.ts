import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { runJobs } from "@/lib/jobs/runner";
import { createAdminClient } from "@/lib/supabase/admin";
import { withSpan } from "@/lib/telemetry";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const result = await withSpan("cron.jobs", {}, async () => {
    const { data: reaped } = await createAdminClient().rpc("reap_stale_jobs", {});
    return { reaped, ...(await runJobs({ budgetMs: 55_000 })) };
  });
  return NextResponse.json(result);
}
