import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";

export type EnqueueOptions = {
  businessId?: string | null;
  payload?: Json;
  /** Collapses duplicates while a job with the same key is queued or running. */
  dedupeKey?: string;
  runAt?: Date;
  maxAttempts?: number;
};

export async function enqueue(type: string, opts: EnqueueOptions = {}) {
  const { data, error } = await createAdminClient().rpc("enqueue_job", {
    p_type: type,
    p_business_id: opts.businessId ?? undefined,
    p_payload: opts.payload ?? {},
    p_dedupe_key: opts.dedupeKey,
    p_run_at: opts.runAt?.toISOString(),
    p_max_attempts: opts.maxAttempts,
  });
  if (error) throw error;
  return data as string;
}
