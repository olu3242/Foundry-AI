import { describe, expect, it } from "vitest";
import { describeEvent } from "./activity";

describe("describeEvent", () => {
  it("describes known events in plain language", () => {
    expect(describeEvent({ type: "business.created", payload: { name: "Ama" } })).toBe('Business "Ama" was set up');
  });
  it("falls back to a readable type", () => {
    expect(describeEvent({ type: "thing.did_stuff", payload: {} })).toBe("thing did stuff");
  });
});
