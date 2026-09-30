import { describe, expect, it } from "vitest";
import { effectiveLevel, modeFor } from "./policy";

describe("autonomy policy", () => {
  it("falls back to the default level", () => {
    expect(effectiveLevel("customer.reminder")).toBe(2);
  });
  it("never exceeds what an action can safely do", () => {
    expect(effectiveLevel("capture.record", 5)).toBe(2);
    expect(effectiveLevel("stock.alert", 5)).toBe(4);
  });
  it("respects an owner turning things off", () => {
    expect(modeFor(effectiveLevel("stock.alert", 0))).toBe("skip");
  });
  it("maps levels to modes", () => {
    expect([0, 1, 2, 3, 4, 5].map((l) => modeFor(l as 0))).toEqual(["skip", "suggest", "await_approval", "await_approval", "auto_notify", "auto_notify"]);
  });
});
