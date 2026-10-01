"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireBusiness, WRITER_ROLES } from "@/lib/auth/guards";
import { fail, friendlyDbError, type ActionState } from "@/lib/actions";
import { enqueue } from "@/lib/jobs/queue";
import { runQueuedNow } from "@/lib/jobs/runner";
import { toMinor } from "@/lib/money";

export async function respondToMatch(formData: FormData) {
  const { businessId, opportunityId, status } = z
    .object({ businessId: z.uuid(), opportunityId: z.uuid(), status: z.enum(["interested", "dismissed", "suggested"]) })
    .parse(Object.fromEntries(formData));
  const { supabase } = await requireBusiness(businessId, WRITER_ROLES);
  await supabase.from("opportunity_matches").update({ status }).eq("business_id", businessId).eq("opportunity_id", opportunityId);
  revalidatePath(`/b/${businessId}/market`);
}

export async function findMatches(formData: FormData) {
  const businessId = z.uuid().parse(formData.get("businessId"));
  await requireBusiness(businessId);
  const jobId = await enqueue("market.match", { businessId, dedupeKey: `match-business:${businessId}` });
  await runQueuedNow(jobId);
  revalidatePath(`/b/${businessId}/market`);
}

const postSchema = z.object({
  businessId: z.uuid(),
  title: z.string().trim().min(4).max(140),
  description: z.string().trim().min(10).max(3000),
  category: z.enum(["supply_contract", "buyer_request", "other"]),
  budget: z.coerce.number().nonnegative().optional(),
  deadline: z.iso.date().optional(),
  contact: z.string().trim().min(3).max(200),
});

export async function postOpportunity(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = postSchema.safeParse(Object.fromEntries([...formData.entries()].filter(([, v]) => v !== "")));
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Please check the form.");
  const p = parsed.data;
  const { business, supabase } = await requireBusiness(p.businessId, ["owner"]);
  const { error } = await supabase.from("opportunities").insert({
    title: p.title, description: p.description, category: p.category, contact: p.contact, deadline: p.deadline,
    countries: [business.country_code], posted_by_business_id: p.businessId, currency: business.currency,
    budget_max_minor: p.budget === undefined ? null : toMinor(p.budget, business.currency),
  });
  if (error) return fail(friendlyDbError(error));
  revalidatePath(`/b/${p.businessId}/market`);
  return { ok: true, message: "Posted. Matching businesses will see it shortly." };
}
