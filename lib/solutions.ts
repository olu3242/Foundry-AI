import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";
import type { SolutionRow } from "@/components/progress/solution-list";
import { formatMoney } from "@/lib/money";

/** Active solutions with their latest active version and funnel (B13). */
export async function loadSolutions(supabase: ServerSupabase): Promise<SolutionRow[]> {
  const [{ data: solutions }, { data: stats }] = await Promise.all([
    supabase.from("solutions").select("id, key, name, summary, target_metric, default_window_days, delivery, pricing_model, price_minor, currency, providers(name), solution_versions(id, version, status)").eq("status", "active").order("name"),
    supabase.rpc("solution_effectiveness", {}),
  ]);
  return (solutions ?? []).flatMap((s) => {
    const v = s.solution_versions.filter((x) => x.status === "active").sort((a, b) => b.version - a.version)[0];
    if (!v) return [];
    const st = stats?.find((r) => r.version_id === v.id);
    return [{
      key: s.key, name: s.name, summary: s.summary, target_metric: s.target_metric, default_window_days: s.default_window_days,
      version_id: v.id, version: v.version, activated: st?.activated ?? 0, completed: st?.completed ?? 0,
      improved: st?.improved ?? 0, verified: st?.verified ?? 0, sample_ok: st?.sample_ok ?? false,
      provider: s.providers?.name ?? null, provider_led: s.delivery === "provider_led",
      price: s.pricing_model === "free" || !s.price_minor ? (s.providers ? "free" : null)
        : `${formatMoney(s.price_minor, s.currency ?? "NGN")}${s.pricing_model === "monthly" ? "/month" : s.pricing_model === "success_fee" ? " success fee" : ""}`,
    }];
  });
}
