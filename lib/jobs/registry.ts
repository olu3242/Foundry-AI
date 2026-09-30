import type { JobHandler } from "./types";

/**
 * Job type → handler. Types are `domain.action`. Feature batches register here;
 * unknown types are dead-lettered so they surface instead of looping.
 */
export const handlers: Record<string, JobHandler> = {
  "system.ping": async ({ job }) => ({ pong: true, at: new Date().toISOString(), payload: job.payload }),
};

export type JobType = keyof typeof handlers;
