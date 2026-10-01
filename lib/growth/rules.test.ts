import { describe, expect, it } from "vitest";
import { growthActions, whatsappLink } from "./rules";

describe("growthActions", () => {
  const base = { businessName: "Ada Foods", currency: "NGN", pulse: [], debtors: [], stock: [] };

  it("turns at-risk pulse signals into suggestions with their reason", () => {
    const [a] = growthActions({ ...base, pulse: [{ dimension: "cash_flow", state: "at_risk", why: "More out than in.", action: "Collect debts." }] });
    expect(a).toMatchObject({ action_type: "growth.recommend", dedupe_key: "pulse:cash_flow", source: "pulse" });
    expect(a!.body).toContain("Collect debts.");
  });

  it("drafts reminders only for debts older than a week, biggest first", () => {
    const actions = growthActions({ ...base, debtors: [
      { customer_id: "a", name: "Bisi", phone: "2348000000001", owed_minor: 500_000, oldest_days: 3 },
      { customer_id: "b", name: "Tunde", phone: null, owed_minor: 200_000, oldest_days: 20 },
      { customer_id: "c", name: "Ngozi", phone: "2348000000003", owed_minor: 900_000, oldest_days: 40 },
    ] });
    expect(actions.map((a) => a.payload.customer_id)).toEqual(["c", "b"]);
    expect(String(actions[0]!.payload.message)).toContain("₦9,000");
  });

  it("flags impossible stock counts", () => {
    const [a] = growthActions({ ...base, stock: [{ product_id: "p", name: "Rice", qty: -2, reorder_level: null }] });
    expect(a!.title).toBe("Check your count of Rice");
  });

  it("builds WhatsApp links", () => {
    expect(whatsappLink("+234 800 000 0001", "Hi there")).toBe("https://wa.me/2348000000001?text=Hi%20there");
  });
});
