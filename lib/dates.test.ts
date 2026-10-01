import { describe, expect, it } from "vitest";
import { daysAgo, monthRange, zonedMidnight } from "./dates";

describe("dates", () => {
  it("computes local midnight in UTC", () => {
    expect(zonedMidnight("Africa/Lagos", 2026, 8, 1).toISOString()).toBe("2026-08-31T23:00:00.000Z");
    expect(zonedMidnight("Africa/Accra", 2026, 8, 1).toISOString()).toBe("2026-09-01T00:00:00.000Z");
    expect(zonedMidnight("Africa/Nairobi", 2026, 8, 1).toISOString()).toBe("2026-08-31T21:00:00.000Z");
  });
  it("builds month ranges that roll over years", () => {
    const at = new Date("2026-01-15T10:00:00Z");
    const prev = monthRange("Africa/Lagos", at, 1);
    expect(prev.from.toISOString()).toBe("2025-11-30T23:00:00.000Z");
    expect(prev.to.toISOString()).toBe("2025-12-31T23:00:00.000Z");
  });
  it("handles late-night local dates", () => {
    // 23:30 UTC on the 14th is already the 15th in Nairobi.
    expect(daysAgo("Africa/Nairobi", 0, new Date("2026-03-14T23:30:00Z")).toISOString()).toBe("2026-03-14T21:00:00.000Z");
  });
});
