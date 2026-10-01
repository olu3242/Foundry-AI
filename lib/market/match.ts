import type { Provenance } from "@/lib/passport/facts";

export type OpportunityInput = {
  sectors: string[]; countries: string[]; min_months_records: number; min_proof_level: Provenance; deadline: string | null;
};
export type BusinessProfile = {
  sector: string | null; country_code: string; months_with_records: number; highest_level: Provenance | null;
  strong_signals: number; attention_signals: number;
};

const RANK: Record<Provenance, number> = { self_reported: 0, document_backed: 1, third_party_verified: 2, institution_verified: 3 };
const LEVEL_LABEL: Record<Provenance, string> = {
  self_reported: "self-reported records", document_backed: "document-backed records",
  third_party_verified: "third-party verification", institution_verified: "institution verification",
};

/** Explainable fit: hard requirements decide eligibility; soft signals rank. Gaps say what would qualify you. */
export function matchOpportunity(o: OpportunityInput, b: BusinessProfile, today = new Date()) {
  const reasons: string[] = [];
  const gaps: string[] = [];
  let score = 40;

  if (o.deadline && new Date(`${o.deadline}T23:59:59Z`) < today) return { eligible: false, score: 0, reasons, gaps: ["The deadline has passed."] };

  if (o.countries.length) {
    if (o.countries.includes(b.country_code)) { reasons.push("Open to businesses in your country"); score += 10; }
    else gaps.push("Only open to businesses in other countries");
  }
  if (o.sectors.length) {
    if (b.sector && o.sectors.includes(b.sector)) { reasons.push(`Looking for ${b.sector.toLowerCase()} businesses`); score += 20; }
    else gaps.push("Aimed at a different line of business");
  }
  if (b.months_with_records >= o.min_months_records) {
    if (o.min_months_records > 0) { reasons.push(`Your ${b.months_with_records} months of records meet the ${o.min_months_records}-month requirement`); score += 10; }
  } else {
    gaps.push(`Needs ${o.min_months_records} months of records; you have ${b.months_with_records}`);
  }
  const level = b.highest_level ?? "self_reported";
  if (RANK[level] >= RANK[o.min_proof_level]) {
    if (o.min_proof_level !== "self_reported") { reasons.push(`Your Passport has ${LEVEL_LABEL[level]}`); score += 10; }
  } else {
    gaps.push(`Needs ${LEVEL_LABEL[o.min_proof_level]} on your Passport`);
  }
  score += Math.min(10, b.strong_signals * 2) - Math.min(10, b.attention_signals * 3);

  const hardGaps = gaps.filter((g) => !g.startsWith("Aimed at"));
  return { eligible: hardGaps.length === 0, score: Math.max(0, Math.min(100, Math.round(score))), reasons, gaps };
}
