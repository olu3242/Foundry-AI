import { describe, expect, it } from "vitest";
import { computePulse, scorers, stateFor, type Metrics } from "./score";

const zero: Metrics = {
  sales_30: 0, sales_prev_30: 0, sales_count_30: 0, collected_30: 0, expenses_30: 0, expenses_prev_30: 0,
  receivable_total: 0, receivable_over_30: 0, customers_60: 0, repeat_customers_60: 0, products_count: 0,
  products_negative: 0, products_low: 0, active_days_30: 0, records_30: 0, records_captured_30: 0,
  records_verified_30: 0, tenure_days: 0,
};
const healthy: Metrics = {
  ...zero, sales_30: 1_200_000, sales_prev_30: 1_000_000, sales_count_30: 40, collected_30: 1_100_000,
  expenses_30: 800_000, expenses_prev_30: 750_000, receivable_total: 100_000, customers_60: 10, repeat_customers_60: 5,
  products_count: 8, active_days_30: 22, records_30: 60, records_captured_30: 45, records_verified_30: 6, tenure_days: 90,
};

describe("pulse scoring", () => {
  it("maps scores to states", () => {
    expect([80, 60, 40, 10, null].map(stateFor)).toEqual(["strong", "steady", "watch", "at_risk", "insufficient_data"]);
  });

  it("says when there isn't enough data instead of guessing", () => {
    const results = computePulse(zero, null, "NGN");
    expect(results).toHaveLength(9);
    expect(results.every((r) => r.state === "insufficient_data")).toBe(true);
  });

  it("scores a healthy business as strong or steady with explanations", () => {
    const results = computePulse(healthy, null, "NGN");
    for (const r of results) {
      expect(["strong", "steady"]).toContain(r.state);
      expect(r.why.length).toBeGreaterThan(10);
    }
  });

  it("flags sales decline with an action", () => {
    const r = scorers.sales_momentum({ ...healthy, sales_30: 500_000 }, "NGN");
    expect(r.score).toBeLessThan(35);
    expect(r.why).toContain("down 50%");
    expect(r.action).toBeTruthy();
  });

  it("penalises old debts", () => {
    const fresh = scorers.receivables({ ...healthy, receivable_total: 300_000, receivable_over_30: 0 }, "GHS").score!;
    const stale = scorers.receivables({ ...healthy, receivable_total: 300_000, receivable_over_30: 300_000 }, "GHS").score!;
    expect(stale).toBeLessThan(fresh);
  });

  it("computes trend against the previous window", () => {
    const down = computePulse({ ...healthy, active_days_30: 5 }, healthy, "NGN").find((r) => r.dimension === "record_keeping")!;
    expect(down.trend).toBe("down");
    expect(down.evidence.previous_score).toBe(100);
  });
});
