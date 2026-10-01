import "server-only";
import { PermanentJobError, type JobHandler } from "@/lib/jobs/types";
import { ACTION_TYPES, effectiveLevel, modeFor, type ActionType } from "@/lib/autonomy/policy";
import type { Json } from "@/lib/supabase/database.types";
import { growthActions, type Debtor } from "./rules";
import { rankSolutions, type Ranked } from "@/lib/learning/rank";

type MemoryContext = {
  prior_plans: { title: string; when: string; status: string; result: { improved: boolean; delta: number; layer: string } | null }[];
  declined: number; recurring: { at_risk: number; checks: number } | null;
};

/** Lineage: bump when rules or ranking change so evaluation can compare versions. */
export const GENERATOR = "rules-v2-ranked";

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

  // B13 + B18: for each Pulse dimension, the active solution with the best verified track record
  // (Bayesian-smoothed; catalogue order when evidence is sparse).
  const [{ data: solutions }, { data: rankStats }] = await Promise.all([
    admin.from("solutions").select("key, name, summary, target_dimension, target_metric, default_window_days, created_at, solution_versions(id, version, status)")
      .eq("status", "active").order("created_at"),
    admin.rpc("solution_rank_stats"),
  ]);
  const byDimension = new Map<string, { key: string; name: string; summary: string; target_metric: string; default_window_days: number; version_id: string; rank: Ranked }>();
  const dims = new Set((solutions ?? []).map((s) => s.target_dimension).filter((d): d is string => Boolean(d)));
  for (const dim of dims) {
    const pool = (solutions ?? []).flatMap((s, order) => {
      if (s.target_dimension !== dim) return [];
      const v = s.solution_versions.filter((x) => x.status === "active").sort((a, b) => b.version - a.version)[0];
      if (!v) return [];
      const st = rankStats?.find((r) => r.solution_version_id === v.id);
      return [{ s, cand: { version_id: v.id, key: s.key, completed: st?.completed ?? 0, verified_improved: st?.verified_improved ?? 0, catalogue_order: order } }];
    });
    const [best] = rankSolutions(pool.map((p) => p.cand));
    const sol = best && pool.find((p) => p.cand.version_id === best.version_id)!.s;
    if (best && sol) byDimension.set(dim, { ...sol, version_id: best.version_id, rank: best });
  }

  const drafts = growthActions({ businessName: business.name, currency: business.currency, pulse: pulse ?? [], debtors: [...debtors.values()], stock });
  // B32: recommendations carry the business's own history on the topic (facts only, with evidence layers).
  await admin.rpc("refresh_business_memory", { p_business_id: bid });
  const memory = new Map<string, MemoryContext>();
  for (const dim of new Set(drafts.filter((d) => d.action_type === "growth.recommend").map((d) => String(d.payload.dimension)))) {
    const { data } = await admin.rpc("memory_context", { p_business_id: bid, p_topic: dim });
    if (data) memory.set(dim, data as unknown as MemoryContext);
  }
  for (const d of drafts) {
    const sol = d.action_type === "growth.recommend" ? byDimension.get(String(d.payload.dimension)) : null;
    if (sol) {
      d.payload = { ...d.payload, solution_key: sol.key, solution_version_id: sol.version_id, metric: sol.target_metric, window_days: sol.default_window_days, plan_title: sol.name };
      (d as typeof d & { rank?: Ranked }).rank = sol.rank;
      d.body = `${d.body} Suggested plan: ${sol.name}. ${sol.summary}`;
    }
    const ctx = d.action_type === "growth.recommend" ? memory.get(String(d.payload.dimension)) : undefined;
    if (ctx) {
      d.payload = { ...d.payload, history: ctx as unknown as Json };
      const last = ctx.prior_plans[0];
      if (last) {
        const when = new Date(last.when).toLocaleDateString("en", { month: "short", year: "numeric" });
        const res = last.result ? (last.result.improved ? `it improved (${last.result.layer})` : `it did not improve (${last.result.layer})`) : `it was ${last.status}`;
        d.body = `${d.body} Last time (${when}) you ran "${last.title}": ${res}.`;
      }
      if (ctx.recurring) d.body = `${d.body} This has come up ${ctx.recurring.at_risk} times in your last ${ctx.recurring.checks} Pulse checks.`;
    }
  }
  const levelOf = new Map((policies ?? []).map((p) => [p.action_type, p.level]));
  // Skip anything already waiting in the inbox, or already actioned this week.
  const seen = new Set((open ?? []).map((a) => `${a.action_type}|${a.dedupe_key}`));

  const { data: run } = await admin.from("agent_runs").insert({
    business_id: bid, agent: "growth", trigger: `job:${job.id}`, model: GENERATOR, prompt_version: GENERATOR, status: "succeeded",
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
    const { data: inserted, error } = await admin.from("agent_actions").insert({
      business_id: bid, agent_run_id: run?.id ?? null, action_type: d.action_type, autonomy_level: level,
      title: d.title, body: d.body, payload: d.payload as { [key: string]: Json }, source: d.source, dedupe_key: d.dedupe_key,
      status: auto ? "executed" : "proposed", executed_at: auto ? new Date().toISOString() : null,
      generator: GENERATOR,
      solution_version_id: (d.payload.solution_version_id as string | undefined) ?? null,
      rank_score: (d as typeof d & { rank?: Ranked }).rank?.score ?? null,
      rank_basis: (d as typeof d & { rank?: Ranked }).rank
        ? { method: (d as typeof d & { rank?: Ranked }).rank!.method, completed: (d as typeof d & { rank?: Ranked }).rank!.completed, verified_improved: (d as typeof d & { rank?: Ranked }).rank!.verified_improved }
        : null,
      expires_at: new Date(Date.now() + 14 * 86_400_000).toISOString(),
    }).select("id").maybeSingle();
    if (error && error.code !== "23505") throw error;
    // B33: every recommendation is backed by a canonical, replayable decision object.
    if (inserted && d.action_type === "growth.recommend") {
      const { error: decisionError } = await admin.rpc("create_decision", { p_business_id: bid, p_topic: String(d.payload.dimension), p_agent_action_id: inserted.id });
      if (decisionError) throw decisionError;
    }
    if (!error && auto) {
      counts.notified += 1;
      await admin.from("events").insert({ business_id: bid, type: "agent.notified", actor_type: "agent", entity_type: "agent_action", payload: { title: d.title, action_type: d.action_type } });
    } else if (!error) counts.proposed += 1;
  }
  // Retry-safe: any open recommendation without its decision object gets one now.
  const { data: undecided } = await admin.from("agent_actions").select("id, payload, decisions(id)").eq("business_id", bid)
    .eq("action_type", "growth.recommend").eq("status", "proposed");
  for (const a of undecided ?? []) {
    if (a.decisions.length) continue;
    const { error: decisionError } = await admin.rpc("create_decision", { p_business_id: bid, p_topic: String((a.payload as { dimension?: string }).dimension), p_agent_action_id: a.id });
    if (decisionError) throw decisionError;
  }
  if (counts.proposed) {
    await admin.from("events").insert({ business_id: bid, type: "agent.proposed", actor_type: "agent", payload: { count: counts.proposed } });
  }
  return { ...counts, types: Object.keys(ACTION_TYPES).length };
};
