import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { runJobs } from "@/lib/jobs/runner";
import { createAdminClient } from "@/lib/supabase/admin";
import { withSpan } from "@/lib/telemetry";
import { enqueue } from "@/lib/jobs/queue";
import { paystackConfigured } from "@/lib/payments/paystack";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const result = await withSpan("cron.jobs", {}, async () => {
    const { data: reaped } = await createAdminClient().rpc("reap_stale_jobs", {});
    // B43: hourly provider reconciliation (dedupe key = the hour).
    if (paystackConfigured()) await enqueue("payments.reconcile", { dedupeKey: `payments:${new Date().toISOString().slice(0, 13)}` });
    return { reaped, ...(await runJobs({ budgetMs: 55_000 })) };
  });
  return NextResponse.json(result);
}
