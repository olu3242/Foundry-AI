"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

export async function deprecateVersion(formData: FormData) {
  const { versionId, reason } = z.object({ versionId: z.uuid(), reason: z.string().trim().min(3).max(300) }).parse(Object.fromEntries(formData));
  await requireUser("/admin");
  const supabase = await createClient();
  await supabase.rpc("deprecate_solution_version", { p_version_id: versionId, p_reason: reason });
  revalidatePath("/admin/solutions");
}

export async function reviewProvider(formData: FormData) {
  const { id, status } = z.object({ id: z.uuid(), status: z.enum(["approved", "suspended"]) }).parse(Object.fromEntries(formData));
  await requireUser("/admin");
  const supabase = await createClient();
  await supabase.rpc("review_provider", { p_provider_id: id, p_status: status });
  revalidatePath("/admin/solutions");
}

export async function reviewSolution(formData: FormData) {
  const { id, decision, note } = z.object({ id: z.uuid(), decision: z.enum(["active", "rejected"]), note: z.string().max(500).optional() }).parse(Object.fromEntries(formData));
  await requireUser("/admin");
  const supabase = await createClient();
  await supabase.rpc("review_solution", { p_solution_id: id, p_decision: decision, p_note: note || undefined });
  revalidatePath("/admin/solutions");
}
