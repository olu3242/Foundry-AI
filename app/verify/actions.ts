"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { fail, friendlyDbError, type ActionState } from "@/lib/actions";

export async function registerVerifier(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser("/verify");
  const parsed = z.object({
    name: z.string().trim().min(3).max(120), kind: z.enum(["institution", "auditor", "individual", "program", "provider"]),
    accreditation: z.string().max(300).optional(),
  }).safeParse(Object.fromEntries(formData));
  const claims = formData.getAll("claims").map(String);
  if (!parsed.success || !claims.length) return fail("Add a name and at least one kind of claim you can check.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("register_verifier", {
    p_name: parsed.data.name, p_kind: parsed.data.kind, p_allowed_claims: claims, p_accreditation: parsed.data.accreditation || undefined,
  });
  if (error) return fail(friendlyDbError(error));
  revalidatePath("/verify");
  return { ok: true, message: "Registered. Foundry will review it before businesses can choose you." };
}

export async function attest(formData: FormData) {
  const { id, result, method, note } = z.object({
    id: z.uuid(), result: z.enum(["confirmed", "partially_confirmed", "not_confirmed"]),
    method: z.enum(["records_review", "bank_statement", "mobile_money_statement", "registry_check", "site_visit", "other"]), note: z.string().max(1000).optional(),
  }).parse(Object.fromEntries(formData));
  await requireUser("/verify");
  const supabase = await createClient();
  await supabase.rpc("attest_claim", { p_request_id: id, p_result: result, p_method: method, p_note: note || undefined });
  revalidatePath("/verify");
}

export async function correct(formData: FormData) {
  const { id, result, note } = z.object({
    id: z.uuid(), result: z.enum(["confirmed", "partially_confirmed", "not_confirmed"]), note: z.string().trim().min(3).max(1000),
  }).parse(Object.fromEntries(formData));
  await requireUser("/verify");
  const supabase = await createClient();
  await supabase.rpc("correct_attestation", { p_attestation_id: id, p_result: result, p_note: note });
  revalidatePath("/verify");
}
