"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { safeNext } from "@/lib/auth/guards";
import { fail, parseForm, type ActionState } from "@/lib/actions";

const phoneSchema = z.object({
  phone: z
    .string()
    .transform((v) => v.replace(/[^\d]/g, ""))
    .pipe(z.string().regex(/^\d{8,15}$/, "Enter your number with country code, e.g. 233 20 000 0001")),
});

export async function sendPhoneOtp(_: ActionState, formData: FormData): Promise<ActionState<{ phone: string }>> {
  const parsed = parseForm(phoneSchema, formData);
  if (!parsed.ok) return parsed.state;
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({ phone: parsed.data.phone });
  if (error) return fail(error.status === 429 ? "Too many attempts. Wait a minute and try again." : "We couldn't send a code to that number.");
  return { ok: true, data: { phone: parsed.data.phone }, message: "We sent you a 6-digit code." };
}

const verifySchema = phoneSchema.extend({
  token: z.string().regex(/^\d{6}$/, "Enter the 6-digit code"),
  next: z.string().optional(),
});

export async function verifyPhoneOtp(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseForm(verifySchema, formData);
  if (!parsed.ok) return parsed.state;
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ phone: parsed.data.phone, token: parsed.data.token, type: "sms" });
  if (error) return fail("That code didn't work. Check it or request a new one.");
  redirect(safeNext(parsed.data.next));
}

const emailSchema = z.object({ email: z.email("Enter a valid email"), next: z.string().optional() });

export async function sendEmailLink(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseForm(emailSchema, formData);
  if (!parsed.ok) return parsed.state;
  const supabase = await createClient();
  const callback = new URL("/auth/callback", publicEnv.NEXT_PUBLIC_SITE_URL);
  callback.searchParams.set("next", safeNext(parsed.data.next));
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { emailRedirectTo: callback.toString() },
  });
  if (error) return fail(error.status === 429 ? "Too many attempts. Wait a minute and try again." : "We couldn't send the link.");
  return { ok: true, message: "Check your email for a sign-in link." };
}
