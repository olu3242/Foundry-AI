import { describe, expect, it } from "vitest";
import { matchOpportunity, type BusinessProfile, type OpportunityInput } from "./match";

const opp: OpportunityInput = { sectors: ["Food & catering"], countries: ["NG"], min_months_records: 3, min_proof_level: "document_backed", deadline: null };
const biz: BusinessProfile = { sector: "Food & catering", country_code: "NG", months_with_records: 4, highest_level: "document_backed", strong_signals: 3, attention_signals: 0 };

describe("matchOpportunity", () => {
  it("explains why a business fits", () => {
    const m = matchOpportunity(opp, biz);
    expect(m.eligible).toBe(true);
    expect(m.score).toBeGreaterThanOrEqual(80);
    expect(m.reasons).toContain("Your 4 months of records meet the 3-month requirement");
  });

  it("says exactly what is missing", () => {
    const m = matchOpportunity(opp, { ...biz, months_with_records: 1, highest_level: null });
    expect(m.eligible).toBe(false);
    expect(m.gaps).toEqual(["Needs 3 months of records; you have 1", "Needs document-backed records on your Passport"]);
  });

  it("treats another sector as a weaker fit, not a hard no", () => {
    const m = matchOpportunity(opp, { ...biz, sector: "Wholesale" });
    expect(m.eligible).toBe(true);
    expect(m.score).toBeLessThan(matchOpportunity(opp, biz).score);
  });

  it("closes expired opportunities", () => {
    expect(matchOpportunity({ ...opp, deadline: "2020-01-01" }, biz).eligible).toBe(false);
  });
});
