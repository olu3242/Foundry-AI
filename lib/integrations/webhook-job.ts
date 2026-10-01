import "server-only";
import { createHmac } from "node:crypto";
import type { JobHandler } from "@/lib/jobs/types";
import { PermanentJobError } from "@/lib/jobs/types";
import { EgressBlockedError, safeFetch } from "@/lib/net/safe-fetch";

/** Signature a receiver recomputes: hex HMAC-SHA256 of `${t}.${body}` with the subscription secret. */
export function signWebhook(secret: string, body: string, t: number) {
  return `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${body}`).digest("hex")}`;
}

type Delivery = { id: string; url: string; secret: string; event_type: string; payload: unknown; status: string; attempts: number; active: boolean };

/** Delivers one webhook. Non-2xx or network errors throw, so the job queue retries with backoff. */
export const deliverWebhook: JobHandler = async ({ job, admin, signal }) => {
  const id = (job.payload as { delivery_id?: string }).delivery_id;
  if (!id) throw new PermanentJobError("payload.delivery_id missing");
  const { data } = await admin.rpc("webhook_delivery_for_send", { p_delivery_id: id });
  const d = data as unknown as Delivery | null;
  if (!d) throw new PermanentJobError("delivery not found");
  if (d.status === "delivered") return { skipped: "delivered" };
  if (!d.active) {
    await admin.rpc("record_webhook_attempt", { p_delivery_id: id, p_status: 0, p_error: "subscription inactive", p_final: true });
    return { skipped: "inactive" };
  }

  const body = JSON.stringify(d.payload);
  const t = Math.floor(Date.now() / 1000);
  const final = job.attempts >= job.max_attempts;
  let status = 0;
  let error: string | null = null;
  try {
    // B41: SSRF-safe egress (no private targets, no redirects, connect-time DNS check).
    const res = await safeFetch(d.url, {
      method: "POST", body, signal, timeoutMs: 10_000,
      headers: { "Content-Type": "application/json", "Foundry-Event": d.event_type, "Foundry-Delivery": d.id, "Foundry-Signature": signWebhook(d.secret, body, t) },
    });
    status = res.status;
    if (!res.ok) error = `HTTP ${res.status}`;
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
    if (e instanceof EgressBlockedError) {
      await admin.rpc("record_webhook_attempt", { p_delivery_id: id, p_status: 0, p_error: error, p_final: true });
      throw new PermanentJobError(error);
    }
  }
  await admin.rpc("record_webhook_attempt", { p_delivery_id: id, p_status: status, p_error: error ?? "", p_final: final });
  if (error) throw new Error(`webhook ${d.id}: ${error}`);
  return { delivered: d.id, status };
};
