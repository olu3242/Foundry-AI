"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireBusiness, WRITER_ROLES } from "@/lib/auth/guards";
import { fail, friendlyDbError, type ActionState } from "@/lib/actions";
import type { Json } from "@/lib/supabase/database.types";

export async function togglePack(formData: FormData) {
  const { businessId, pack, on } = z.object({ businessId: z.uuid(), pack: z.string().regex(/^[a-z_]{3,40}$/), on: z.enum(["true", "false"]) }).parse(Object.fromEntries(formData));
  const { supabase } = await requireBusiness(businessId, ["owner"]);
  await supabase.rpc("activate_pack", { p_business_id: businessId, p_pack_key: pack, p_on: on === "true" });
  revalidatePath(`/b/${businessId}`, "layout");
}

/** Generic entry for any pack entity: values are typed by the pack's field spec on the server. */
export async function recordPackEntry(_: ActionState, formData: FormData): Promise<ActionState> {
  const { businessId, pack, entity, ...rest } = Object.fromEntries(formData) as Record<string, string>;
  const ids = z.object({ businessId: z.uuid(), pack: z.string().regex(/^[a-z_]{3,40}$/), entity: z.string().regex(/^[a-z_]{2,40}$/) })
    .safeParse({ businessId, pack, entity });
  if (!ids.success) return fail("Something went wrong. Reload and try again.");
  const { supabase } = await requireBusiness(ids.data.businessId, WRITER_ROLES);
  const data: Record<string, Json> = {};
  for (const [k, v] of Object.entries(rest)) {
    if (k.startsWith("$") || v === "") continue;
    const typed = k.endsWith(":number") ? Number(v) : v;
    data[k.replace(/:number$/, "")] = typed;
  }
  const { error } = await supabase.rpc("record_pack_entry", { p_business_id: ids.data.businessId, p_pack_key: ids.data.pack, p_entity: ids.data.entity, p_data: data });
  if (error) return fail(friendlyDbError(error.code === "22023" ? { ...error, code: "P0001" } : error));
  revalidatePath(`/b/${ids.data.businessId}/pack/${ids.data.pack}`);
  return { ok: true, message: "Saved." };
}
