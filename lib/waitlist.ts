import { z } from "zod";

export const WAITLIST_ROLES = [
  "Business owner",
  "Program / bank / sponsor",
  "Partner",
  "Business Partner applicant",
  "Other",
] as const;

export function isValidWaitlistContact(value: string) {
  const contact = value.trim();
  if (contact.length > 254) return false;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)) return true;
  if (!/^\+?[\d\s().-]+$/.test(contact)) return false;
  const digits = contact.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

export function normalizeWaitlistContact(value: string) {
  const contact = value.trim();
  return contact.includes("@") ? contact.toLowerCase() : contact.replace(/[\s().-]/g, "");
}

export const waitlistSubmissionSchema = z.object({
  role: z.enum(WAITLIST_ROLES),
  contact: z.string().trim().min(7).max(254).refine(isValidWaitlistContact),
  country: z.string().trim().max(80).optional().default(""),
  consent: z.literal("yes"),
  website: z.string().max(200).optional().default(""),
}).strict();

export type WaitlistSubmission = z.infer<typeof waitlistSubmissionSchema>;