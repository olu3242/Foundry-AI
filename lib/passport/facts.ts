import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export const PASSPORT_SECTIONS = ["summary", "track_record", "proof", "pulse"] as const;
export type PassportSection = (typeof PASSPORT_SECTIONS)[number];
export const SECTION_LABEL: Record<PassportSection, string> = {
  summary: "Business summary",
  track_record: "Track record (monthly sales)",
  proof: "Proof and verifications",
  pulse: "Pulse signals",
};

export type Provenance = "self_reported" | "document_backed" | "third_party_verified" | "institution_verified";

export type PassportFacts = {
  name: string; sector: string | null; country_code: string; currency: string; on_foundry_since: string;
  first_record_at: string | null; months_with_records: number; active_days_90: number; records_180: number;
  provenance_180: Partial<Record<Provenance, number>>;
  monthly_sales: { month: string; sales_minor: number }[];
  highest_level: Provenance | null;
  verified_outcomes: { title: string; metric: string; baseline: number; observed: number; delta: number; verifier_role: string; at: string }[];
  verifications: { level: Provenance; method: string; subject: string; period_start: string | null; period_end: string | null; verifier_role: string; at: string }[];
};

export type PassportPulse = { dimension: string; state: string; why: string }[];

/** Loads passport data with the service role. Callers must have already authorised access. */
export async function loadPassport(businessId: string, sections: readonly PassportSection[]) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("passport_facts", { p_business_id: businessId });
  if (error || !data) throw error ?? new Error("passport not found");
  let pulse: PassportPulse | null = null;
  if (sections.includes("pulse")) {
    const { data: latest } = await admin.from("pulse_snapshots").select("computed_on").eq("business_id", businessId)
      .order("computed_on", { ascending: false }).limit(1).maybeSingle();
    if (latest) {
      const { data: rows } = await admin.from("pulse_snapshots").select("dimension, state, why").eq("business_id", businessId).eq("computed_on", latest.computed_on);
      pulse = rows ?? [];
    }
  }
  return { facts: data as unknown as PassportFacts, pulse };
}
