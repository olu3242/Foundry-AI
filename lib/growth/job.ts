import "server-only";
import { PermanentJobError, type JobHandler } from "@/lib/jobs/types";
import { ACTION_TYPES, effectiveLevel, modeFor, type ActionType } from "@/lib/autonomy/policy";
import type { Json } from "@/lib/supabase/database.types";
import { growthActions, type Debtor } from "./rules";

export const growthJob: JobHandler = async ({ job, admin }) => {
  const bid = job.business_id;
  if (!bid) throw new PermanentJobError("business_id required");
  const started = Date.now();
  const { data: business } = await admin.from("businesses").select("name, currency").eq("id", bid).maybeSingle();
  if (!business) throw new PermanentJobError("business not found");

  const [{ data: latest }, { data: policies }, { data: credit }, { data: products }, { data: open }] = await Promise.all([
    admin.from("pulse_snapshots").select("computed_on").eq("business_id", bid).order("computed_on", { ascending: false }).limit(1).maybeSingle(),
    admin.from("autonomy_policies").select("action_type, level").eq("business_id", bid),
    admin.from("sales").select("customer_id, total_minor, amount_paid_minor, occurred_at, customers(name, phone)")
      .eq("business_id", bid).is("voided_at", null).not("customer_id", "is", null).limit(2000),
    admin.from("products").select("id, name, stock_qty, reorder_level").eq("business_id", bid),
    admin.from("agent_actions").select("action_type, dedupe_key, status, created_at").eq("business_id", bid)
      .or(`status.eq.proposed,created_at.gte.${new Date(Date.now() - 7 * 86_400_000).toISOString()}`),
  ]);
  const { data: pulse } = latest
    ? await admin.from("pulse_snapshots").select("dimension, state, why, action").eq("business_id", bid).eq("computed_on", latest.computed_on)
    : { data: [] };

  const debtors = new Map<string, Debtor>();
  for (const s of credit ?? []) {
    const owed = s.total_minor - s.amount_paid_minor;
    if (owed <= 0 || !s.customer_id) continue;
    const days = Math.floor((Date.now() - new Date(s.occurred_at).getTime()) / 86_400_000);
    const d = debtors.get(s.customer_id) ?? { customer_id: s.customer_id, name: s.customers?.name ?? "Customer", phone: s.customers?.phone ?? null, owed_minor: 0, oldest_days: 0 };
    d.owed_minor += owed;
    d.oldest_days = Math.max(d.oldest_days, days);
    debtors.set(s.customer_id, d);
  }
  const stock = (products ?? [])
    .map((p) => ({ product_id: p.id, name: p.name, qty: Number(p.stock_qty), reorder_level: p.reorder_level === null ? null : Number(p.reorder_level) }))
    .filter((p) => p.qty < 0 || (p.reorder_level !== null && p.qty <= p.reorder_level));

  const drafts = growthActions({ businessName: business.name, currency: business.currency, pulse: pulse ?? [], debtors: [...debtors.values()], stock });
  const levelOf = new Map((policies ?? []).map((p) => [p.action_type, p.level]));
  // Skip anything already waiting in the inbox, or already actioned this week.
  const seen = new Set((open ?? []).map((a) => `${a.action_type}|${a.dedupe_key}`));

  const { data: run } = await admin.from("agent_runs").insert({
    business_id: bid, agent: "growth", trigger: `job:${job.id}`, model: "rules-v1", status: "succeeded",
    output: { proposed: drafts.length } as Json, latency_ms: Date.now() - started,
  }).select("id").single();

  const counts = { proposed: 0, notified: 0, skipped: 0 };
  for (const d of drafts) {
    const level = effectiveLevel(d.action_type as ActionType, levelOf.get(d.action_type));
    const mode = modeFor(level);
    if (mode === "skip" || seen.has(`${d.action_type}|${d.dedupe_key}`)) {
      counts.skipped += 1;
      continue;
    }
    const auto = mode === "auto_notify";
    const { error } = await admin.from("agent_actions").insert({
      business_id: bid, agent_run_id: run?.id ?? null, action_type: d.action_type, autonomy_level: level,
      title: d.title, body: d.body, payload: d.payload as { [key: string]: Json }, source: d.source, dedupe_key: d.dedupe_key,
      status: auto ? "executed" : "proposed", executed_at: auto ? new Date().toISOString() : null,
      expires_at: new Date(Date.now() + 14 * 86_400_000).toISOString(),
    });
    if (error && error.code !== "23505") throw error;
    if (!error && auto) {
      counts.notified += 1;
      await admin.from("events").insert({ business_id: bid, type: "agent.notified", actor_type: "agent", entity_type: "agent_action", payload: { title: d.title, action_type: d.action_type } });
    } else if (!error) counts.proposed += 1;
  }
  if (counts.proposed) {
    await admin.from("events").insert({ business_id: bid, type: "agent.proposed", actor_type: "agent", payload: { count: counts.proposed } });
  }
  return { ...counts, types: Object.keys(ACTION_TYPES).length };
};
