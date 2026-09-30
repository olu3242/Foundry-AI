import { describe, expect, it } from "vitest";
import { rankSolutions, type Candidate } from "./rank";

const c = (key: string, completed: number, verified: number, order = 0): Candidate => ({ version_id: key, key, completed, verified_improved: verified, catalogue_order: order });

describe("rankSolutions", () => {
  it("prefers solutions with more verified improvements per completion", () => {
    const [top] = rankSolutions([c("a", 10, 2), c("b", 10, 7)]);
    expect(top!.key).toBe("b");
    expect(top!.method).toBe("evidence");
  });
  it("does not let one lucky result beat solid evidence", () => {
    const ranked = rankSolutions([c("lucky", 1, 1), c("solid", 20, 12)]);
    expect(ranked[0]!.key).toBe("solid");
    expect(ranked[1]!.method).toBe("prior");
  });
  it("falls back to catalogue order when nothing has evidence", () => {
    expect(rankSolutions([c("second", 0, 0, 2), c("first", 0, 0, 1)]).map((r) => r.key)).toEqual(["first", "second"]);
  });
  it("shrinks small samples toward the network mean", () => {
    const [r] = rankSolutions([c("x", 3, 3), c("y", 30, 3)]);
    expect(r!.score).toBeLessThan(1);
  });
});
