import "server-only";
import type { JobHandler } from "@/lib/jobs/types";
import { serverEnv } from "@/lib/env";
import { safeFetch } from "@/lib/net/safe-fetch";
import { effectiveDate, usdPerUnit } from "./parse";

/** B44 daily FX refresh from the configured provider. On failure, last rates stay and go stale (visible). */
export const refreshFxJob: JobHandler = async ({ admin }) => {
  const env = serverEnv();
  if (!env.FX_PROVIDER || !env.FX_API_KEY) return { skipped: "fx_provider_not_configured" };
  const { data: current, error } = await admin.from("fx_rates").select("currency");
  if (error) throw error;
  const base = env.FX_API_BASE ?? "https://openexchangerates.org";
  const res = await safeFetch(`${base}/api/latest.json?app_id=${encodeURIComponent(env.FX_API_KEY)}`, { method: "GET" });
  if (!res.ok) throw new Error(`FX provider HTTP ${res.status}`);
  const body = JSON.parse(res.text) as { timestamp?: number; base?: string; rates?: Record<string, unknown> };
  if (body.base !== "USD" || !body.rates) throw new Error("FX provider returned an unexpected payload");
  const rates = usdPerUnit(body.rates, (current ?? []).map((r) => r.currency));
  const { data: updated, error: recordError } = await admin.rpc("record_fx_rates", {
    p_source: env.FX_PROVIDER, p_effective_date: effectiveDate(body.timestamp), p_rates: rates,
  });
  if (recordError) throw recordError;
  return { updated, requested: current?.length ?? 0 };
};
