import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";

/** B20 due-diligence pack: the same numbers the dashboard shows, with their definitions. */
export async function buildEvidencePack(supabase: ServerSupabase) {
  const now = new Date();
  const since = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();
  const [m30, m90, cohorts, solutions, learning, integrity, security] = await Promise.all([
    supabase.rpc("scale_metrics", { p_from: since(30), p_to: now.toISOString() }),
    supabase.rpc("scale_metrics", { p_from: since(90), p_to: now.toISOString() }),
    supabase.rpc("cohort_retention", { p_months: 6 }),
    supabase.rpc("solution_effectiveness", {}),
    supabase.rpc("learning_overview"),
    supabase.rpc("integrity_report"),
    supabase.rpc("security_report"),
  ]);
  const security_ok = security.data ? Object.values(security.data as Record<string, unknown[]>).every((v) => Array.isArray(v) && v.length === 0) : false;
  // Business-data signals (negative stock = sales recorded without the purchase) and dead jobs are
  // reported but not system integrity violations; everything else must be zero.
  const INFORMATIONAL = new Set(["dead_jobs_7d", "negative_stock_products"]);
  const integrity_ok = integrity.data ? Object.entries(integrity.data as Record<string, number>).every(([k, v]) => INFORMATIONAL.has(k) || v === 0) : false;
  return {
    generated_at: now.toISOString(),
    loop: "LOW-DATA BUSINESS → STRUCTURED RECORD → USEFUL SIGNAL → EXECUTED SOLUTION → VERIFIED OUTCOME → OPERATOR LEVERAGE → PARTNER DISTRIBUTION → LEARNING ADVANTAGE → MEASURABLE ECONOMICS",
    definitions: {
      vei: "Verified Economic Impact = verified incremental revenue + verified savings + verified avoided losses (USD at recorded FX). Measured before/after a plan and checked by a partner; association, not proof of causation.",
      activation: "A business that records a sale or expense within 7 days of creation.",
      retention: "Share of businesses active in the previous period that are active in this period.",
      verified_outcome_rate: "Verified improvements ÷ completed plans.",
    },
    metrics_30d: m30.data, metrics_90d: m90.data, cohort_retention: cohorts.data,
    solution_effectiveness: solutions.data, learning: learning.data,
    certification: { security_ok, integrity_ok, security: security.data, integrity: integrity.data },
  };
}
