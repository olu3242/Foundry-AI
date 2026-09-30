import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";
import type { PulseState } from "@/lib/pulse/score";

export type PortfolioRow = {
  business_id: string; name: string; sector: string | null; country_code: string; currency: string;
  states: Partial<Record<PulseState, number>>;
  statesAtStart: Partial<Record<PulseState, number>> | null;
  lastActivity: string | null;
};

const tally = (rows: { state: PulseState }[]) =>
  rows.reduce<Partial<Record<PulseState, number>>>((acc, r) => ({ ...acc, [r.state]: (acc[r.state] ?? 0) + 1 }), {});

/**
 * Portfolio view for partners and program admins. Uses the caller's own client, so RLS
 * (consent + assignment) decides which businesses appear.
 */
export async function loadPortfolio(supabase: ServerSupabase, businessIds: string[], since?: Record<string, string>) {
  if (!businessIds.length) return [];
  const [{ data: businesses }, { data: snaps }, { data: events }] = await Promise.all([
    supabase.from("businesses").select("id, name, sector, country_code, currency").in("id", businessIds),
    supabase.from("pulse_snapshots").select("business_id, computed_on, state").in("business_id", businessIds)
      .gte("computed_on", new Date(Date.now() - 400 * 86_400_000).toISOString().slice(0, 10)),
    supabase.from("events").select("business_id, occurred_at").in("business_id", businessIds)
      .in("type", ["sale.recorded", "expense.recorded", "stock.moved"]).order("occurred_at", { ascending: false }).limit(500),
  ]);
  return (businesses ?? []).map<PortfolioRow>((b) => {
    const own = (snaps ?? []).filter((s) => s.business_id === b.id);
    const days = [...new Set(own.map((s) => s.computed_on))].sort();
    const latest = days.at(-1);
    const start = since?.[b.id];
    const baseline = start ? days.find((d) => d >= start.slice(0, 10)) : undefined;
    return {
      business_id: b.id, name: b.name, sector: b.sector, country_code: b.country_code, currency: b.currency,
      states: latest ? tally(own.filter((s) => s.computed_on === latest)) : {},
      statesAtStart: baseline && baseline !== latest ? tally(own.filter((s) => s.computed_on === baseline)) : null,
      lastActivity: (events ?? []).find((e) => e.business_id === b.id)?.occurred_at ?? null,
    };
  });
}
