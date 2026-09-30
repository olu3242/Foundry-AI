import type { JobHandler } from "./types";
import { extractCapture } from "@/lib/capture/extract-job";
import { computePulseJob } from "@/lib/pulse/job";
import { growthJob } from "@/lib/growth/job";
import { marketMatchJob } from "@/lib/market/job";
import { baselineJob, measureOutcomeJob } from "@/lib/interventions/jobs";

/**
 * Job type → handler. Types are `domain.action`. Feature batches register here;
 * unknown types are dead-lettered so they surface instead of looping.
 */
export const handlers: Record<string, JobHandler> = {
  "capture.extract": extractCapture,
  "pulse.compute": computePulseJob,
  "growth.recommend": growthJob,
  "market.match": marketMatchJob,
  "pilot.baseline": baselineJob,
  "benchmarks.compute": async ({ admin }) => {
    const { data, error } = await admin.rpc("compute_benchmarks");
    if (error) throw error;
    return { cohorts: data };
  },
  "outcome.measure": measureOutcomeJob,
  "system.ping": async ({ job }) => ({ pong: true, at: new Date().toISOString(), payload: job.payload }),
};

export type JobType = keyof typeof handlers;
