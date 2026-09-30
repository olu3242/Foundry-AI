"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { fail, friendlyDbError, type ActionState } from "@/lib/actions";
import { toMinor } from "@/lib/money";
import { METRICS, type MetricKey } from "@/lib/interventions/catalog";

export async function registerProvider(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser("/providers");
  const p = z.object({ name: z.string().trim().min(3).max(120), kind: z.enum(["ngo", "consultant", "supplier", "fintech", "trainer", "other"]),
    contact: z.string().trim().min(5).max(200), description: z.string().max(2000).optional() }).safeParse(Object.fromEntries(formData));
  if (!p.success) return fail("Please check the details.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("register_provider", { p_name: p.data.name, p_kind: p.data.kind, p_contact: p.data.contact, p_description: p.data.description });
  if (error) return fail(friendlyDbError(error));
  revalidatePath("/providers");
  return { ok: true, message: "Registered. Foundry will review your profile before you can list solutions." };
}

const metricKeys = Object.keys(METRICS) as [MetricKey, ...MetricKey[]];

export async function submitSolution(_: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser("/providers");
  const parsed = z.object({
    providerId: z.uuid(), name: z.string().trim().min(3).max(120), summary: z.string().trim().min(10).max(1000),
    metric: z.enum(metricKeys), windowDays: z.coerce.number().int().min(1).max(180),
    delivery: z.enum(["self_serve", "provider_led"]), pricingModel: z.enum(["free", "fixed", "monthly", "success_fee"]),
    price: z.coerce.number().min(0).default(0), currency: z.string().regex(/^[A-Za-z]{3}$/), steps: z.string().optional(), terms: z.string().max(1000).optional(),
  }).safeParse(Object.fromEntries([...formData.entries()].filter(([, v]) => v !== "")));
  if (!parsed.success) return fail("Please check the solution details.");
  const p = parsed.data;
  const cur = p.currency.toUpperCase();
  const key = `${p.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 40)}_${Date.now().toString(36)}`;
  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_solution", {
    p_provider_id: p.providerId, p_key: key, p_name: p.name, p_summary: p.summary, p_target_metric: p.metric, p_target_dimension: "",
    p_window_days: p.windowDays, p_playbook: (p.steps ?? "").split("\n").map((s) => s.trim()).filter(Boolean),
    p_delivery: p.delivery, p_pricing_model: p.pricingModel, p_price_minor: toMinor(p.price, cur), p_currency: cur, p_commercial_terms: p.terms,
  });
  if (error) return fail(friendlyDbError(error));
  revalidatePath("/providers");
  return { ok: true, message: "Submitted for review." };
}

export async function postUpdate(formData: FormData) {
  const { engagementId, note } = z.object({ engagementId: z.uuid(), note: z.string().trim().min(2).max(1000) }).parse(Object.fromEntries(formData));
  await requireUser("/providers");
  const supabase = await createClient();
  await supabase.rpc("post_engagement_update", { p_engagement_id: engagementId, p_note: note });
  revalidatePath("/providers");
}
