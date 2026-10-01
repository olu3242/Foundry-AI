import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { signWebhook } = await import("./webhook-job");

describe("webhook signatures", () => {
  it("signs `${t}.${body}` so receivers can verify and reject replays", () => {
    const sig = signWebhook("whsec_x", '{"a":1}', 1700000000);
    expect(sig).toBe(`t=1700000000,v1=${createHmac("sha256", "whsec_x").update('1700000000.{"a":1}').digest("hex")}`);
  });
  it("changes when the body changes", () => {
    expect(signWebhook("s", "a", 1)).not.toBe(signWebhook("s", "b", 1));
  });
});
