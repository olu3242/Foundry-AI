import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { mapChargeStatus, verifyPaystackSignature } from "./signature";

describe("Paystack webhook signature", () => {
  const body = JSON.stringify({ event: "charge.success", data: { reference: "fdy_1" } });
  const sig = createHmac("sha512", "sk_test_x").update(body).digest("hex");
  it("accepts the HMAC-SHA512 of the raw body", () => expect(verifyPaystackSignature(body, sig, "sk_test_x")).toBe(true));
  it("rejects a tampered body, wrong key or missing header", () => {
    expect(verifyPaystackSignature(body.replace("fdy_1", "fdy_2"), sig, "sk_test_x")).toBe(false);
    expect(verifyPaystackSignature(body, sig, "sk_test_y")).toBe(false);
    expect(verifyPaystackSignature(body, null, "sk_test_x")).toBe(false);
  });
});

describe("charge status mapping", () => {
  it("only success settles; unknown states stay pending for re-verification", () => {
    expect(mapChargeStatus("success")).toBe("success");
    expect(mapChargeStatus("reversed")).toBe("failed");
    expect(mapChargeStatus("abandoned")).toBe("abandoned");
    expect(mapChargeStatus("ongoing")).toBe("pending");
    expect(mapChargeStatus("queued")).toBe("pending");
  });
});
