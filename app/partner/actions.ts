"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { fail, friendlyDbError, type ActionState } from "@/lib/actions";

/** Batch actions over selected queue items: snooze, or nudge the businesses behind them. */
export async function batchAction(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser("/partner");
  const items = formData.getAll("item").map(String);
  const parsed = z.object({ op: z.enum(["snooze", "nudge", "done"]), days: z.coerce.number().int().min(1).max(30).default(3), message: z.string().optional() })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success || !items.length) return fail("Select at least one item.");
  const supabase = await createClient();
  if (parsed.data.op === "done") {
    // B22: operator confirms the recovery step was taken; the scan marks it recovered once activity resumes.
    // B23: escalations resolve the same way.
    const keys = items.map((i) => i.split("|")[0]!);
    const ids = keys.filter((k) => k.startsWith("recover:")).map((k) => k.slice("recover:".length));
    const escalations = keys.filter((k) => k.startsWith("escalate:")).map((k) => k.slice("escalate:".length));
    if (!ids.length && !escalations.length) return fail("Select at least one recovery or escalated item.");
    for (const id of ids) {
      const { error } = await supabase.rpc("close_recovery_action", { p_id: id, p_status: "done", p_note: parsed.data.message || undefined });
      if (error) return fail(friendlyDbError(error));
    }
    for (const id of escalations) {
      const { error } = await supabase.rpc("resolve_escalation", { p_id: id });
      if (error) return fail(friendlyDbError(error));
    }
    revalidatePath("/partner");
    return { ok: true, message: ids.length ? `Marked ${ids.length} recovery step(s) done.` : `Resolved ${escalations.length} escalation(s).` };
  }
  if (parsed.data.op === "snooze") {
    const keys = items.map((i) => i.split("|")[0]!);
    const { error } = await supabase.rpc("snooze_items", { p_item_keys: keys, p_days: parsed.data.days });
    if (error) return fail(friendlyDbError(error));
    revalidatePath("/partner");
    return { ok: true, message: `Snoozed ${items.length} item(s) for ${parsed.data.days} days.` };
  }
  const businessIds = [...new Set(items.map((i) => i.split("|")[1]).filter((v): v is string => z.uuid().safeParse(v).success))];
  const { data, error } = await supabase.rpc("batch_nudge", { p_business_ids: businessIds, p_message: parsed.data.message ?? "" });
  if (error) return fail(friendlyDbError(error));
  revalidatePath("/partner");
  return { ok: true, message: `Sent a note to ${data ?? 0} business(es).` };
}
