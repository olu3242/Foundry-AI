"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireBusiness } from "@/lib/auth/guards";
import { fail, friendlyDbError, type ActionState } from "@/lib/actions";

export async function choosePlan(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = z.object({ businessId: z.uuid(), plan: z.string().regex(/^[a-z0-9_]{2,40}$/) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Choose a plan.");
  const { supabase } = await requireBusiness(parsed.data.businessId, ["owner"]);
  const { error } = await supabase.rpc("choose_plan", { p_business_id: parsed.data.businessId, p_plan_key: parsed.data.plan });
  if (error) return fail(friendlyDbError(error));
  revalidatePath(`/b/${parsed.data.businessId}/plan`);
  return { ok: true, message: "Plan updated." };
}
