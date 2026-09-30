import type { JobHandler } from "./types";
import { extractCapture } from "@/lib/capture/extract-job";
import { computePulseJob } from "@/lib/pulse/job";
import { growthJob } from "@/lib/growth/job";
import { marketMatchJob } from "@/lib/market/job";

/**
 * Job type → handler. Types are `domain.action`. Feature batches register here;
 * unknown types are dead-lettered so they surface instead of looping.
 */
export const handlers: Record<string, JobHandler> = {
  "capture.extract": extractCapture,
  "pulse.compute": computePulseJob,
  "growth.recommend": growthJob,
  "market.match": marketMatchJob,
  "system.ping": async ({ job }) => ({ pong: true, at: new Date().toISOString(), payload: job.payload }),
};

export type JobType = keyof typeof handlers;
