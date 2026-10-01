import type { JobHandler } from "./types";
import { extractCapture } from "@/lib/capture/extract-job";
import { computePulseJob } from "@/lib/pulse/job";
import { growthJob } from "@/lib/growth/job";
import { marketMatchJob } from "@/lib/market/job";
import { baselineJob, measureOutcomeJob } from "@/lib/interventions/jobs";
import { deliverWebhook } from "@/lib/integrations/webhook-job";

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
  "metrics.rollup": async ({ admin }) => {
    const { data, error } = await admin.rpc("rollup_metrics");
    if (error) throw error;
    return { keys: data };
  },
  "learning.snapshot": async ({ admin }) => {
    const { data, error } = await admin.rpc("take_eval_snapshot");
    if (error) throw error;
    return { rows: data };
  },
  "benchmarks.compute": async ({ admin }) => {
    const { data, error } = await admin.rpc("compute_benchmarks");
    if (error) throw error;
    return { cohorts: data };
  },
  "outcome.measure": measureOutcomeJob,
  "webhook.deliver": deliverWebhook,
  "ops.routine": async ({ admin }) => {
    const { data, error } = await admin.rpc("run_routine_ops", {});
    if (error) throw error;
    return data;
  },
  "forecast.compute": async ({ admin }) => {
    const { data, error } = await admin.rpc("compute_all_forecasts");
    if (error) throw error;
    return { forecasts: data };
  },
  "experiments.evaluate": async ({ admin }) => {
    const { data, error } = await admin.rpc("evaluate_experiments");
    if (error) throw error;
    return { experiments: data };
  },
  "incidents.detect": async ({ admin }) => {
    const { data, error } = await admin.rpc("detect_incidents");
    if (error) throw error;
    return data;
  },
  "quality.scan": async ({ admin }) => {
    const { data, error } = await admin.rpc("scan_data_quality", {});
    if (error) throw error;
    return data;
  },
  "retention.scan": async ({ admin }) => {
    const { data, error } = await admin.rpc("scan_retention");
    if (error) throw error;
    return data;
  },
  "system.ping": async ({ job }) => ({ pong: true, at: new Date().toISOString(), payload: job.payload }),
};

export type JobType = keyof typeof handlers;
