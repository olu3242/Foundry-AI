"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireBusiness, WRITER_ROLES } from "@/lib/auth/guards";

const schema = z.object({ businessId: z.uuid(), actionId: z.uuid(), decision: z.enum(["approved", "rejected", "executed"]) });

export async function decideAction(formData: FormData) {
  const { businessId, actionId, decision } = schema.parse(Object.fromEntries(formData));
  const { supabase } = await requireBusiness(businessId, WRITER_ROLES);
  await supabase.rpc("decide_action", { p_action_id: actionId, p_decision: decision });
  revalidatePath(`/b/${businessId}`, "layout");
}
