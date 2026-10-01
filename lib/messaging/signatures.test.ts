import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { tokenMatches, verifyMetaSignature } from "./signatures";

describe("messaging webhook authentication (B42)", () => {
  const body = '{"entry":[]}';
  const sig = `sha256=${createHmac("sha256", "s3cret").update(body).digest("hex")}`;
  it("accepts a valid Meta signature", () => expect(verifyMetaSignature(body, sig, "s3cret")).toBe(true));
  it("rejects a tampered body, wrong secret or missing header", () => {
    expect(verifyMetaSignature(`${body} `, sig, "s3cret")).toBe(false);
    expect(verifyMetaSignature(body, sig, "other")).toBe(false);
    expect(verifyMetaSignature(body, null, "s3cret")).toBe(false);
  });
  it("compares callback tokens in constant time and refuses empties", () => {
    expect(tokenMatches("abc", "abc")).toBe(true);
    expect(tokenMatches("abd", "abc")).toBe(false);
    expect(tokenMatches(null, "abc")).toBe(false);
    expect(tokenMatches("abc", undefined)).toBe(false);
  });
});
