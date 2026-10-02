import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  serverEnv: () => ({
    MESSAGING_ENABLED: "1",
    PAYSTACK_SECRET_KEY: "test",
    FX_PROVIDER: "openexchangerates",
    FX_API_KEY: "test",
  }),
}));
vi.mock("@/lib/messaging/providers", () => ({
  PROVIDERS: [{ name: "whatsapp_cloud", channel: "whatsapp", configured: () => true }],
}));
vi.mock("@/lib/payments/paystack", () => ({ paystackConfigured: () => true }));

import { resolveCapability } from "./registry";

describe("Foundry capability registry", () => {
  it("allows internal compute", () => {
    expect(resolveCapability({ kind: "internal.compute" }).allowed).toBe(true);
  });
  it("resolves a configured messaging provider", () => {
    const result = resolveCapability({ kind: "messaging", provider: "whatsapp_cloud" });
    expect(result.allowed).toBe(true);
    if (result.allowed) expect(result.provider).toBe("whatsapp_cloud");
  });
  it("allows configured Paystack", () => {
    expect(resolveCapability({ kind: "payments.paystack" }).allowed).toBe(true);
  });
  it("rejects unknown capabilities permanently", () => {
    expect(resolveCapability({ kind: "unknown.vendor" })).toEqual({
      allowed: false, health: "unavailable", reason: "unknown_capability", retryable: false,
    });
  });
});
