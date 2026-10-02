import { describe, expect, it } from "vitest";
import { isValidWaitlistContact, normalizeWaitlistContact, waitlistSubmissionSchema } from "@/lib/waitlist";

describe("waitlist input", () => {
  it("normalizes email case and phone formatting for deduplication", () => {
    expect(normalizeWaitlistContact(" Ama@Example.COM ")).toBe("ama@example.com");
    expect(normalizeWaitlistContact("+234 (803) 000-0000")).toBe("+2348030000000");
  });

  it("accepts valid email and international phone contacts", () => {
    expect(isValidWaitlistContact("ama@example.com")).toBe(true);
    expect(isValidWaitlistContact("+234 (803) 000-0000")).toBe(true);
  });

  it("rejects malformed or oversized contact values", () => {
    expect(isValidWaitlistContact("not-a-contact")).toBe(false);
    expect(isValidWaitlistContact("1".repeat(255))).toBe(false);
  });

  it("requires a supported role and explicit contact consent", () => {
    const base = { role: "Business owner", contact: "ama@example.com", country: "Ghana", website: "" };
    expect(waitlistSubmissionSchema.safeParse({ ...base, consent: "yes" }).success).toBe(true);
    expect(waitlistSubmissionSchema.safeParse(base).success).toBe(false);
    expect(waitlistSubmissionSchema.safeParse({ ...base, consent: "yes", role: "Engineer" }).success).toBe(false);
  });
});