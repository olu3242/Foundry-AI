"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireBusiness } from "@/lib/auth/guards";

export async function refreshOutlook(formData: FormData) {
  const { businessId } = z.object({ businessId: z.uuid() }).parse(Object.fromEntries(formData));
  const { supabase } = await requireBusiness(businessId);
  await supabase.rpc("compute_forecasts", { p_business_id: businessId });
  revalidatePath(`/b/${businessId}/outlook`);
}
