"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireBusiness } from "@/lib/auth/guards";
import { enqueue } from "@/lib/jobs/queue";
import { runJobNow } from "@/lib/jobs/runner";

export async function refreshPulse(formData: FormData) {
  const businessId = z.uuid().parse(formData.get("businessId"));
  await requireBusiness(businessId);
  const jobId = await enqueue("pulse.compute", { businessId, dedupeKey: `pulse:${businessId}` });
  // The debounced job may be scheduled in the future; pull it forward for an explicit refresh.
  await runJobNow(jobId);
  revalidatePath(`/b/${businessId}/pulse`);
}
