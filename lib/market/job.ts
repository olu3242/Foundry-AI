import "server-only";
import type { AdminSupabase } from "@/lib/supabase/admin";
import type { JobHandler } from "@/lib/jobs/types";
import type { PassportFacts } from "@/lib/passport/facts";
import { effectiveLevel } from "@/lib/autonomy/policy";
import { matchOpportunity, type BusinessProfile } from "./match";

async function profile(admin: AdminSupabase, businessId: string): Promise<BusinessProfile | null> {
  const [{ data: facts }, { data: policy }, { data: latest }] = await Promise.all([
    admin.rpc("passport_facts", { p_business_id: businessId }),
    admin.from("autonomy_policies").select("level").eq("business_id", businessId).eq("action_type", "market.match").maybeSingle(),
    admin.from("pulse_snapshots").select("state, computed_on").eq("business_id", businessId).order("computed_on", { ascending: false }).limit(9),
  ]);
  if (!facts || effectiveLevel("market.match", policy?.level) === 0) return null;
  const f = facts as unknown as PassportFacts;
  const day = latest?.[0]?.computed_on;
  const today = (latest ?? []).filter((r) => r.computed_on === day);
  return {
    sector: f.sector, country_code: f.country_code, months_with_records: f.months_with_records, highest_level: f.highest_level,
    strong_signals: today.filter((r) => r.state === "strong").length,
    attention_signals: today.filter((r) => r.state === "at_risk").length,
  };
}

/** payload.opportunity_id → match every business to it; job.business_id → match that business to every open opportunity. */
export const marketMatchJob: JobHandler = async ({ job, admin }) => {
  const oppId = (job.payload as { opportunity_id?: string }).opportunity_id;
  const oppQuery = admin.from("opportunities").select("id, sectors, countries, min_months_records, min_proof_level, deadline").eq("status", "open");
  const { data: opps } = oppId ? await oppQuery.eq("id", oppId) : await oppQuery;
  const businessIds = job.business_id
    ? [job.business_id]
    // Tech debt: fine for MVP scale; move to a set-based SQL match beyond a few thousand businesses.
    : ((await admin.from("businesses").select("id").is("archived_at", null).limit(5000)).data ?? []).map((b) => b.id);

  let written = 0;
  for (const bid of businessIds) {
    const p = await profile(admin, bid);
    if (!p || !opps?.length) continue;
    const rows = opps.map((o) => {
      const m = matchOpportunity(o, p);
      return { opportunity_id: o.id, business_id: bid, score: m.score, eligible: m.eligible, reasons: m.reasons, gaps: m.gaps };
    });
    const { error } = await admin.from("opportunity_matches").upsert(rows, { onConflict: "opportunity_id,business_id" });
    if (error) throw error;
    written += rows.length;
  }
  return { businesses: businessIds.length, opportunities: opps?.length ?? 0, written };
};
