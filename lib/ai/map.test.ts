import { describe, expect, it } from "vitest";
import { toDrafts } from "./map";

const base = { confidence: 0.9, evidence: [{ field: "total", quote: "90k" }], explanation: "A cash sale.", occurred_on: null };

describe("toDrafts", () => {
  it("converts major units to minor and derives totals from items", () => {
    const { drafts } = toDrafts(
      [{ ...base, kind: "sale", customer_name: "Mama Bisi", total: 0, amount_paid: null, payment_method: "cash",
         items: [{ description: "Rice", product_name: "Rice 50kg", quantity: 2, unit_price: 45000 }] }],
      "NGN",
    );
    expect(drafts[0]?.fields).toMatchObject({ total_minor: 9_000_000, customer_name: "Mama Bisi" });
    expect(drafts[0]?.fields.items).toEqual([{ description: "Rice", product_name: "Rice 50kg", quantity: 2, unit_price_minor: 4_500_000 }]);
  });

  it("respects zero-decimal currencies", () => {
    const { drafts } = toDrafts(
      [{ ...base, kind: "expense", category: "Transport", description: null, amount: 1500, payment_method: "mobile_money", supplier: null }],
      "XOF",
    );
    expect(drafts[0]?.fields.amount_minor).toBe(1500);
  });

  it("drops invalid records instead of drafting them", () => {
    const { drafts, rejected } = toDrafts(
      [{ ...base, kind: "sale", customer_name: null, total: 100, amount_paid: 500, payment_method: "cash", items: [] },
       { ...base, kind: "stock_movement", product_name: "Soap", quantity_delta: 0, reason: "adjustment", unit_cost: null }],
      "GHS",
    );
    expect(drafts).toHaveLength(0);
    expect(rejected.map((r) => r.kind)).toEqual(["sale", "stock_movement"]);
  });

  it("clamps confidence and keeps valid dates", () => {
    const { drafts } = toDrafts([{ ...base, confidence: 1.7, occurred_on: "2026-09-01", kind: "customer", name: "Kofi", phone: null }], "GHS");
    expect(drafts[0]?.confidence).toBe(1);
    expect(drafts[0]?.fields).toEqual({ name: "Kofi" });
  });
});
