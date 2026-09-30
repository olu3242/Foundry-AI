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
