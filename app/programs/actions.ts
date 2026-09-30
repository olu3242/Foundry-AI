"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { fail, friendlyDbError, type ActionState } from "@/lib/actions";
import { billingConfigured, getStripe } from "@/lib/billing/stripe";
import { publicEnv, serverEnv } from "@/lib/env";

export async function createProgram(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser("/programs");
  const parsed = z.object({
    name: z.string().trim().min(3).max(120), sponsor: z.string().trim().max(120).optional(), description: z.string().trim().max(2000).optional(),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Give the program a name (3+ characters).");
  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("create_program", {
    p_name: parsed.data.name, p_sponsor_name: parsed.data.sponsor, p_description: parsed.data.description,
  });
  if (error || !id) return fail(error ? friendlyDbError(error) : "Could not create the program.");
  redirect(`/programs/${id}`);
}

export async function addProgramMember(_: ActionState, formData: FormData): Promise<ActionState> {
  const { programId, contact, role } = z.object({ programId: z.uuid(), contact: z.string().trim().min(5), role: z.enum(["admin", "partner"]) }).parse(Object.fromEntries(formData));
  await requireUser(`/programs/${programId}`);
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_program_member", { p_program_id: programId, p_contact: contact, p_role: role });
  if (error) return fail(friendlyDbError(error));
  revalidatePath(`/programs/${programId}`);
  return { ok: true, message: "Added." };
}

export async function assignPartner(formData: FormData) {
  const { programId, partnerId, businessId } = z.object({ programId: z.uuid(), partnerId: z.uuid(), businessId: z.uuid() }).parse(Object.fromEntries(formData));
  await requireUser(`/programs/${programId}`);
  const supabase = await createClient();
  await supabase.rpc("assign_partner", { p_program_id: programId, p_partner_user_id: partnerId, p_business_id: businessId });
  revalidatePath(`/programs/${programId}`);
}

export async function startCheckout(formData: FormData) {
  const programId = z.uuid().parse(formData.get("programId"));
  const user = await requireUser(`/programs/${programId}`);
  const supabase = await createClient();
  const { data: program } = await supabase.from("programs").select("id, name, seats, stripe_customer_id").eq("id", programId).maybeSingle();
  const { data: me } = await supabase.from("program_members").select("role").eq("program_id", programId).eq("user_id", user.id).maybeSingle();
  if (!program || me?.role !== "admin" || !billingConfigured()) redirect(`/programs/${programId}?billing=unavailable`);

  const session = await getStripe()!.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: serverEnv().STRIPE_PROGRAM_PRICE_ID!, quantity: program.seats }],
    customer: program.stripe_customer_id ?? undefined,
    customer_email: program.stripe_customer_id ? undefined : (user.email ?? undefined),
    client_reference_id: program.id,
    metadata: { program_id: program.id },
    subscription_data: { metadata: { program_id: program.id } },
    success_url: new URL(`/programs/${program.id}?billing=success`, publicEnv.NEXT_PUBLIC_SITE_URL).toString(),
    cancel_url: new URL(`/programs/${program.id}?billing=cancelled`, publicEnv.NEXT_PUBLIC_SITE_URL).toString(),
  }, { idempotencyKey: `checkout:${program.id}:${program.seats}:${new Date().toISOString().slice(0, 13)}` });
  redirect(session.url!);
}
