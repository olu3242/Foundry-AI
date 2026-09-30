"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireBusiness } from "@/lib/auth/guards";
import { fail, friendlyDbError, parseForm, type ActionState } from "@/lib/actions";
import { effectiveLevel } from "@/lib/autonomy/policy";

const businessSchema = z.object({
  businessId: z.uuid(),
  name: z.string().trim().min(2).max(120),
  sector: z.string().trim().max(60).optional(),
});

export async function updateBusiness(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseForm(businessSchema, formData);
  if (!parsed.ok) return parsed.state;
  const { businessId, name, sector } = parsed.data;
  const { supabase } = await requireBusiness(businessId, ["owner"]);
  const { error } = await supabase.from("businesses").update({ name, sector: sector || null }).eq("id", businessId);
  if (error) return fail(friendlyDbError(error));
  revalidatePath(`/b/${businessId}`, "layout");
  return { ok: true, message: "Saved." };
}

const memberSchema = z.object({
  businessId: z.uuid(),
  contact: z.string().trim().min(5).max(254),
  role: z.enum(["owner", "staff", "partner"]),
});

export async function addMember(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseForm(memberSchema, formData);
  if (!parsed.ok) return parsed.state;
  const { businessId, contact, role } = parsed.data;
  const { supabase } = await requireBusiness(businessId, ["owner"]);
  const { error } = await supabase.rpc("add_member", { p_business_id: businessId, p_contact: contact, p_role: role });
  if (error) return fail(friendlyDbError(error));
  revalidatePath(`/b/${businessId}/settings`);
  return { ok: true, message: "Added to the team." };
}

const autonomySchema = z.object({
  businessId: z.uuid(),
  actionType: z.enum(["capture.record", "growth.recommend", "customer.reminder", "stock.alert", "market.match"]),
  level: z.coerce.number().int().min(0).max(5),
});

export async function setAutonomy(formData: FormData) {
  const { businessId, actionType, level } = autonomySchema.parse(Object.fromEntries(formData));
  const { supabase } = await requireBusiness(businessId, ["owner"]);
  const capped = effectiveLevel(actionType, level);
  await supabase.from("autonomy_policies").upsert({ business_id: businessId, action_type: actionType, level: capped, updated_at: new Date().toISOString() });
  revalidatePath(`/b/${businessId}/settings`);
}

export async function joinProgram(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z.object({ businessId: z.uuid(), code: z.string().trim().min(4).max(20), consent: z.literal("on") })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Enter the code and tick the consent box.");
  const { supabase } = await requireBusiness(parsed.data.businessId, ["owner"]);
  const { error } = await supabase.rpc("join_program", { p_business_id: parsed.data.businessId, p_join_code: parsed.data.code, p_consent: true });
  if (error) return fail(friendlyDbError(error));
  revalidatePath(`/b/${parsed.data.businessId}/settings`);
  return { ok: true, message: "You've joined. The program team can now see your records." };
}

export async function leaveProgram(formData: FormData) {
  const { businessId, programId } = z.object({ businessId: z.uuid(), programId: z.uuid() }).parse(Object.fromEntries(formData));
  const { supabase } = await requireBusiness(businessId, ["owner"]);
  await supabase.rpc("leave_program", { p_business_id: businessId, p_program_id: programId });
  revalidatePath(`/b/${businessId}/settings`);
}
