import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { log } from "@/lib/telemetry";

export const LIMITS = {
  capture: { limit: 60, windowSeconds: 60 },
  aiExtraction: { limit: 300, windowSeconds: 3600 },
  passportView: { limit: 30, windowSeconds: 60 },
  shareCreate: { limit: 20, windowSeconds: 3600 },
} as const;

export class RateLimitError extends Error {
  constructor() {
    super("Too many requests. Please slow down and try again shortly.");
  }
}

/** Shared fixed-window limiter. Fails open on infrastructure errors (logged). */
export async function rateLimit(key: string, rule: { limit: number; windowSeconds: number }) {
  const { data, error } = await createAdminClient().rpc("hit_rate_limit", {
    p_key: key,
    p_limit: rule.limit,
    p_window_seconds: rule.windowSeconds,
  });
  if (error) {
    log("warn", "rate_limit.unavailable", { key, error: error.message });
    return true;
  }
  return data === true;
}

export async function enforceRateLimit(key: string, rule: { limit: number; windowSeconds: number }) {
  if (!(await rateLimit(key, rule))) throw new RateLimitError();
}
