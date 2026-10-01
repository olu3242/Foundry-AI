import { z } from "zod";

/**
 * Public env is inlined at build time, so each key must be referenced literally.
 * Server env is parsed lazily so `next build` doesn't need runtime secrets.
 */
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
});

export const publicEnv = publicSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "public-anon-key-not-set",
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || undefined,
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  CRON_SECRET: z.string().min(16),
  ANTHROPIC_API_KEY: z.string().optional(),
  AI_EXTRACTION_MODEL: z.string().default("claude-opus-5-5"),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PROGRAM_PRICE_ID: z.string().optional(),
  PASSPORT_TOKEN_PEPPER: z.string().min(16),
  // B42 communication rails (all optional: a channel without credentials is simply not used).
  MESSAGING_ENABLED: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_APP_SECRET: z.string().optional(),
  WHATSAPP_VERIFY_TOKEN: z.string().optional(),
  WHATSAPP_API_BASE: z.url().optional(),
  AFRICASTALKING_USERNAME: z.string().optional(),
  AFRICASTALKING_API_KEY: z.string().optional(),
  AFRICASTALKING_SENDER_ID: z.string().optional(),
  AFRICASTALKING_CALLBACK_TOKEN: z.string().optional(),
  AFRICASTALKING_API_BASE: z.url().optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;
let cached: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  if (typeof window !== "undefined") throw new Error("serverEnv() called in the browser");
  cached ??= serverSchema.parse(process.env);
  return cached;
}
