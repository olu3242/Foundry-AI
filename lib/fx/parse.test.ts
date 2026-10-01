import { describe, expect, it } from "vitest";
import { effectiveDate, usdPerUnit } from "./parse";

describe("FX feed parsing", () => {
  it("inverts units-per-USD and drops missing or invalid rates", () => {
    expect(usdPerUnit({ USD: 1, GHS: 16, NGN: 1600, KES: 0, XOF: "x" }, ["USD", "GHS", "NGN", "KES", "XOF", "ZAR"]))
      .toEqual({ USD: 1, GHS: 0.0625, NGN: 0.000625 });
  });
  it("uses the provider's timestamp as the effective date", () => {
    expect(effectiveDate(1790812800)).toBe("2026-10-01");
    expect(() => effectiveDate(undefined)).toThrow();
  });
});
