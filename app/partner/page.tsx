import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { SimpleShell } from "@/components/shell/simple-shell";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { PortfolioTable } from "@/components/programs/portfolio-table";
import { AttentionQueue, type QueueItem } from "@/components/programs/attention-queue";
import { loadPortfolio } from "@/lib/programs/portfolio";

export const metadata: Metadata = { title: "Portfolio" };

/** B12: exceptions first. The portfolio table is context, not the work list. */
export default async function PartnerPage() {
  const user = await requireUser("/partner");
  const supabase = await createClient();
  const [{ data: queue }, { data: metrics }] = await Promise.all([supabase.rpc("operator_queue"), supabase.rpc("operator_metrics")]);
  const items = (queue ?? []) as QueueItem[];
  const m = (metrics ?? {}) as Record<string, number | null>;
  const ids = [...new Set(items.map((i) => i.business_id))];
  // Everything the operator can read, minus businesses they run themselves.
  const [{ data: readable }, { data: own }] = await Promise.all([
    supabase.from("businesses").select("id"),
    supabase.from("memberships").select("business_id").eq("user_id", user.id).in("role", ["owner", "staff"]),
  ]);
  const ownIds = new Set((own ?? []).map((m) => m.business_id));
  const portfolioIds = (readable ?? []).filter((b) => !ownIds.has(b.id));
  const { data: recent } = await supabase.from("events").select("type, business_id")
    .in("business_id", portfolioIds.map((b) => b.id)).gte("occurred_at", new Date(Date.now() - 86_400_000).toISOString()).limit(1000);
  const rows = await loadPortfolio(supabase, portfolioIds.map((b) => b.id));
  const count = (types: string[]) => (recent ?? []).filter((e) => types.includes(e.type)).length;

  const tiles = [
    { k: "Businesses", v: m.businesses ?? 0 },
    { k: "Need attention", v: ids.length },
    { k: "Resolved (30 days)", v: m.resolved_30d ?? 0 },
    { k: "Median time to resolve", v: m.median_resolution_hours === null || m.median_resolution_hours === undefined ? "—" : `${m.median_resolution_hours} h` },
    { k: "Results verified (30 days)", v: m.verified_outcomes_30d ?? 0 },
  ];

  return (
    <SimpleShell>
      <PageHeader eyebrow="Business partner" title="Today’s brief"
        description={`In the last 24 hours: ${count(["sale.recorded", "expense.recorded", "stock.moved"])} records, ${count(["outcome.observed"])} results measured, ${count(["intervention.started"])} plans started across your portfolio.`} />
      <dl className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        {tiles.map((t) => <div key={t.k} className="glass p-4"><dt className="text-xs text-muted-foreground">{t.k}</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{t.v}</dd></div>)}
      </dl>
      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <Card className="p-0"><CardHeader className="p-5 pb-0"><CardTitle>Needs you ({items.length})</CardTitle></CardHeader><AttentionQueue items={items} /></Card>
        <Card className="p-0"><CardHeader className="p-5 pb-0"><CardTitle>Portfolio</CardTitle></CardHeader><PortfolioTable rows={rows} /></Card>
      </div>
    </SimpleShell>
  );
}
