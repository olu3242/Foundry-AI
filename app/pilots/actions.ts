"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { fail, friendlyDbError, type ActionState } from "@/lib/actions";

const METRICS = ["activation_rate", "recording_rate", "intervention_rate", "verified_outcomes", "improved_outcome_rate", "retention_rate"] as const;

export async function createPilot(_: ActionState, formData: FormData): Promise<ActionState> {
  const f = Object.fromEntries(formData) as Record<string, string>;
  const parsed = z.object({
    name: z.string().trim().min(3).max(120), join_code: z.string().trim().min(4).max(20), country_code: z.string().regex(/^([A-Z]{2})?$/),
    sector: z.string().trim().max(60), target_size: z.coerce.number().int().min(1).max(100000),
    starts_on: z.iso.date(), ends_on: z.iso.date(), escalation_days: z.coerce.number().int().min(1).max(60),
  }).safeParse(f);
  if (!parsed.success) return fail("Check the pilot fields: name, program code, size and dates are required.");
  const success_metrics = METRICS.filter((m) => f[`metric_${m}`]).map((m) => ({ key: m, target: Number(f[`metric_${m}`]) }));
  if (success_metrics.some((m) => !Number.isFinite(m.target))) return fail("Success targets must be numbers.");
  const checkpoints = (f.checkpoints ?? "").split(",").map((c) => c.trim()).filter(Boolean).map((c) => {
    const [day, ...label] = c.split(":");
    return { day: Number(day), label: label.join(":").trim() };
  });
  if (checkpoints.some((c) => !Number.isInteger(c.day) || !c.label)) return fail("Checkpoints look like 0:Kick-off, 30:Mid-point review");
  await requireUser("/pilots");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_pilot", { p_config: { ...parsed.data, success_metrics, checkpoints } });
  if (error) return fail(friendlyDbError(error));
  redirect(`/pilots/${data}`);
}

async function pilotCall(id: string, fn: (s: Awaited<ReturnType<typeof createClient>>) => PromiseLike<{ error: { code?: string; message: string } | null }>, message = "Done."): Promise<ActionState> {
  await requireUser(`/pilots/${id}`);
  const { error } = await fn(await createClient());
  if (error) return fail(friendlyDbError(error));
  revalidatePath(`/pilots/${id}`);
  return { ok: true, message };
}

export async function setPilotStatus(formData: FormData) {
  const { id, status } = z.object({ id: z.uuid(), status: z.enum(["active", "completed", "cancelled"]) }).parse(Object.fromEntries(formData));
  await pilotCall(id, (s) => s.rpc("save_pilot", { p_config: { id, status } }));
}

export async function advancePilots(formData: FormData) {
  const { id } = z.object({ id: z.uuid() }).parse(Object.fromEntries(formData));
  await pilotCall(id, (s) => s.rpc("advance_pilots"));
}

export async function invitePhones(_: ActionState, formData: FormData): Promise<ActionState> {
  const { id, phones } = z.object({ id: z.uuid(), phones: z.string().min(8).max(20000) }).parse(Object.fromEntries(formData));
  return pilotCall(id, (s) => s.rpc("invite_to_pilot", { p_pilot_id: id, p_phones: phones.split(/[\s,;]+/).filter(Boolean) }), "Invites recorded.");
}

export async function addOperator(_: ActionState, formData: FormData): Promise<ActionState> {
  const { id, contact, role } = z.object({ id: z.uuid(), contact: z.string().trim().min(5), role: z.enum(["operator", "sponsor", "support"]) }).parse(Object.fromEntries(formData));
  return pilotCall(id, (s) => s.rpc("add_pilot_operator", { p_pilot_id: id, p_contact: contact, p_role: role }), "Added.");
}
