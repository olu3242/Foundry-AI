import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { log, reportError } from "@/lib/telemetry";
import type { Json } from "@/lib/supabase/database.types";
import { handlers } from "./registry";
import { PermanentJobError, type Job } from "./types";

const JOB_TIMEOUT_MS = 40_000;

async function execute(job: Job, worker: string) {
  const admin = createAdminClient();
  const handler = handlers[job.type];
  const started = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), JOB_TIMEOUT_MS);
  try {
    if (!handler) throw new PermanentJobError(`No handler for job type "${job.type}"`);
    const result = await Promise.race([
      handler({ job, admin, signal: controller.signal }),
      new Promise<never>((_, reject) =>
        controller.signal.addEventListener("abort", () => reject(new Error(`Timed out after ${JOB_TIMEOUT_MS}ms`))),
      ),
    ]);
    await admin.rpc("complete_job", { p_job_id: job.id, p_result: (result ?? null) as Json });
    log("info", "job.succeeded", { worker, job_id: job.id, type: job.type, attempt: job.attempts, ms: Math.round(performance.now() - started) });
    return "succeeded" as const;
  } catch (error) {
    const permanent = error instanceof PermanentJobError;
    const message = error instanceof Error ? error.message : typeof error === "object" && error && "message" in error ? String((error as { message: unknown }).message) : String(error);
    const { data: status } = await admin.rpc("fail_job", { p_job_id: job.id, p_error: message, p_retryable: !permanent });
    reportError(error, { msg: "job.failed", worker, job_id: job.id, type: job.type, attempt: job.attempts, next: status, business_id: job.business_id });
    return status === "dead" ? ("dead" as const) : ("retrying" as const);
  } finally {
    clearTimeout(timer);
  }
}

/** Drains ready jobs until the queue is empty or the time budget is spent. */
export async function runJobs({ budgetMs = 55_000, batchSize = 5, types }: { budgetMs?: number; batchSize?: number; types?: string[] } = {}) {
  const worker = `w-${randomUUID().slice(0, 8)}`;
  const admin = createAdminClient();
  // Only start a batch if even the slowest job in it can finish inside the budget.
  const lastBatchStart = Date.now() + budgetMs - JOB_TIMEOUT_MS;
  const summary = { worker, claimed: 0, succeeded: 0, retrying: 0, dead: 0 };

  while (Date.now() < lastBatchStart) {
    const { data: jobs, error } = await admin.rpc("claim_jobs", { p_worker: worker, p_limit: batchSize, p_types: types });
    if (error) throw error;
    if (!jobs?.length) break;
    summary.claimed += jobs.length;
    const outcomes = await Promise.all(jobs.map((job) => execute(job, worker)));
    for (const o of outcomes) summary[o] += 1;
  }
  return summary;
}

/** Runs one specific job now if it is ready (low-latency path after enqueue). Safe to race with the cron worker. */
export async function runJobNow(jobId: string) {
  const worker = `inline-${randomUUID().slice(0, 8)}`;
  const { data: jobs, error } = await createAdminClient().rpc("claim_jobs", { p_worker: worker, p_limit: 1, p_job_id: jobId });
  if (error || !jobs?.[0]) return null;
  return execute(jobs[0], worker);
}

/** For explicit user requests: pull a queued (possibly debounced) job forward, then run it. */
export async function runQueuedNow(jobId: string) {
  await createAdminClient().from("jobs").update({ run_at: new Date().toISOString() }).eq("id", jobId).eq("status", "queued");
  return runJobNow(jobId);
}
