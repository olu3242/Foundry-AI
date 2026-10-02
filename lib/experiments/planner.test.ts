import { describe, expect, it } from "vitest";
import { planBinaryExperiment } from "./planner";

describe("planBinaryExperiment", () => {
  it("returns a practical two-arm sample size", () => {
    const p = planBinaryExperiment({ baselineRate: 0.3, minimumDetectableLift: 0.15 });
    expect(p.perArm).toBeGreaterThan(100);
    expect(p.perArm).toBeLessThan(200);
    expect(p.total).toBe(p.perArm * 2);
  });

  it("requires more observations for a smaller detectable lift", () => {
    const large = planBinaryExperiment({ baselineRate: 0.3, minimumDetectableLift: 0.2 });
    const small = planBinaryExperiment({ baselineRate: 0.3, minimumDetectableLift: 0.05 });
    expect(small.perArm).toBeGreaterThan(large.perArm);
  });

  it("rejects impossible target rates", () => {
    expect(() => planBinaryExperiment({ baselineRate: 0.9, minimumDetectableLift: 0.2 })).toThrow();
  });
});
