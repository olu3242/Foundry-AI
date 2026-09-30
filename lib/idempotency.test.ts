import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));

const { hashRequest } = await import("./idempotency");

describe("hashRequest", () => {
  it("is stable for equal bodies and differs otherwise", () => {
    expect(hashRequest({ a: 1 })).toBe(hashRequest({ a: 1 }));
    expect(hashRequest({ a: 1 })).not.toBe(hashRequest({ a: 2 }));
    expect(hashRequest(undefined)).toBe(hashRequest(null));
  });
});
