import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { log, reportError } from "@/lib/telemetry";

/** Public API version (date-versioned; breaking changes get a new /api/vN). */
export const API_VERSION = "2026-09-30";

export type ApiIdentity = { id: string; program_id: string; environment: "live" | "sandbox"; scopes: string[]; rate_limit_per_min: number };
export type Scope = "businesses:read" | "outcomes:read" | "reports:read" | "invitations:write" | "events:subscribe";

function problem(status: number, code: string, message: string, requestId: string, extra: Record<string, string> = {}) {
  return NextResponse.json({ error: { code, message }, request_id: requestId },
    { status, headers: { "Foundry-API-Version": API_VERSION, "Foundry-Request-Id": requestId, ...extra } });
}

/**
 * Wraps a /api/v1 handler: bearer-key authentication (hash lookup), scope check, per-identity
 * rate limit, and an audit row for every call — including rejected ones.
 */
export function withApi<C>(scope: Scope, handler: (ctx: { identity: ApiIdentity; admin: ReturnType<typeof createAdminClient>; request: NextRequest; params: C }) => Promise<unknown>) {
  return async (request: NextRequest, context: { params: Promise<C> }) => {
    const started = Date.now();
    const requestId = request.headers.get("x-request-id") ?? randomUUID();
    const admin = createAdminClient();
    const path = new URL(request.url).pathname;
    const key = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!/^fdy_(live|sandbox)_[0-9a-f]{48}$/.test(key)) return problem(401, "unauthenticated", "Send your API key as: Authorization: Bearer fdy_…", requestId);
    const { data } = await admin.rpc("api_authenticate", { p_key_hash: createHash("sha256").update(key).digest("hex") });
    const identity = data as unknown as ApiIdentity | null;
    if (!identity) return problem(401, "unauthenticated", "Unknown or revoked API key.", requestId);

    const audit = (status: number, error?: string) =>
      admin.rpc("api_log_call", { p_identity_id: identity.id, p_method: request.method, p_path: path, p_status: status,
        p_latency_ms: Date.now() - started, p_request_id: requestId, p_error: error });

    if (!(await rateLimit(`api:${identity.id}`, { limit: identity.rate_limit_per_min, windowSeconds: 60 }))) {
      await audit(429, "rate_limited");
      return problem(429, "rate_limited", "Too many requests for this key. Retry after a minute.", requestId, { "Retry-After": "60" });
    }
    if (!identity.scopes.includes(scope)) {
      await audit(403, "insufficient_scope");
      return problem(403, "insufficient_scope", `This key lacks the ${scope} scope.`, requestId);
    }
    try {
      const body = await handler({ identity, admin, request, params: await context.params });
      await audit(200);
      return NextResponse.json({ data: body, environment: identity.environment, request_id: requestId },
        { headers: { "Foundry-API-Version": API_VERSION, "Foundry-Request-Id": requestId } });
    } catch (error) {
      const e = error as { status?: number; code?: string; message?: string };
      const status = e.status ?? (e.code === "P0002" ? 404 : e.code === "42501" ? 403 : e.code === "P0001" || e.code === "22023" ? 400 : 500);
      await audit(status, e.message);
      if (status >= 500) reportError(error, { msg: "api.v1.failed", path, requestId });
      else log("info", "api.v1.rejected", { path, status, requestId });
      return problem(status, status === 404 ? "not_found" : status === 400 ? "invalid_request" : status === 403 ? "forbidden" : "internal",
        status >= 500 ? "Something went wrong." : (e.message ?? "Request rejected."), requestId);
    }
  };
}

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** Unwraps a Supabase RPC result, rethrowing its error with the Postgres code. */
export function unwrap<T>({ data, error }: { data: T; error: { code?: string; message: string } | null }): T {
  if (error) throw Object.assign(new Error(error.message), { code: error.code });
  return data;
}
