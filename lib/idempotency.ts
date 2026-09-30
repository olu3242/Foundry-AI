import "server-only";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";

export class IdempotencyConflictError extends Error {
  constructor(message = "This request is already being processed.") {
    super(message);
  }
}

export function hashRequest(body: unknown) {
  return createHash("sha256").update(JSON.stringify(body ?? null)).digest("hex");
}

/**
 * Runs `fn` at most once per (scope, key). A retry with the same key and body gets
 * the stored response; the same key with a different body is rejected. Failures
 * release the key so the client can retry.
 */
export async function withIdempotency<T extends Json>(scope: string, key: string, body: unknown, fn: () => Promise<T>) {
  const admin = createAdminClient();
  const requestHash = hashRequest(body);
  const { error: insertError } = await admin
    .from("idempotency_keys")
    .insert({ scope, key, request_hash: requestHash });

  if (insertError) {
    if (insertError.code !== "23505") throw insertError;
    const { data: existing } = await admin
      .from("idempotency_keys")
      .select("status, request_hash, response")
      .eq("scope", scope)
      .eq("key", key)
      .single();
    if (existing?.request_hash !== requestHash) {
      throw new IdempotencyConflictError("This idempotency key was already used for a different request.");
    }
    if (existing.status === "completed") return { replayed: true as const, response: existing.response as T };
    throw new IdempotencyConflictError();
  }

  try {
    const response = await fn();
    await admin.from("idempotency_keys").update({ status: "completed", response }).eq("scope", scope).eq("key", key);
    return { replayed: false as const, response };
  } catch (error) {
    await admin.from("idempotency_keys").delete().eq("scope", scope).eq("key", key);
    throw error;
  }
}
