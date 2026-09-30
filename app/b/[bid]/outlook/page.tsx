import type { Metadata } from "next";
import { requireBusiness } from "@/lib/auth/guards";
import { PageHeader } from "@/components/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { refreshOutlook } from "./actions";

export const metadata: Metadata = { title: "Outlook" };

const TITLE: Record<string, string> = {
  sales_outlook: "Sales, next 4 weeks", cash_pressure: "Money in vs out, next 2 weeks", inventory_demand: "Stock needed, next 2 weeks",
  collections: "Money owed to you, next 30 days", intervention_scenario: "If you run a proven plan",
};
type R = Record<string, number | boolean | null | undefined>;

function Headline({ kind, r, cur }: { kind: string; r: R; cur: string }) {
  const m = (v: unknown) => formatMoney(Number(v ?? 0), cur);
  if (kind === "sales_outlook") return <p><span className="text-2xl font-semibold">{m(r.point)}</span> <span className="text-sm text-muted-foreground">likely between {m(r.low)} and {m(r.high)}</span></p>;
  if (kind === "cash_pressure") return <p className="text-sm">In ≈ {m(r.expected_in)} · Out ≈ {m(r.expected_out)} {r.warning ? <Badge tone="attention">Money may run short</Badge> : <Badge tone="brand">Looks covered</Badge>}</p>;
  if (kind === "inventory_demand") return <p className="text-sm">≈ {Number(r.point ?? 0)} units ({Number(r.low ?? 0)}–{Number(r.high ?? 0)}) · {r.days_of_stock != null ? `${r.days_of_stock} days of stock left` : "stock unknown"} {r.runs_out_within_horizon && <Badge tone="attention">Restock soon</Badge>}</p>;
  if (kind === "collections") return <p className="text-sm">≈ {m(r.expected_minor)} of {m(r.open_minor)} ({m(r.low_minor)}–{m(r.high_minor)})</p>;
  return <p className="text-sm">{Math.round(Number(r.improvement_rate ?? 0) * 100)}% of businesses that completed it improved{r.scenario_point != null ? ` · your outlook ≈ ${m(r.scenario_point)}` : ""}</p>;
}

export default async function OutlookPage({ params }: { params: Promise<{ bid: string }> }) {
  const { bid } = await params;
  const { business, supabase } = await requireBusiness(bid);
  const { data } = await supabase.rpc("latest_forecasts", { p_business_id: bid });
  const forecasts = data ?? [];
  const checks = await Promise.all(forecasts.map(async (f) => ((await supabase.rpc("reproduce_forecast", { p_forecast_id: f.id })).data as { matches: boolean } | null)?.matches));

  return (
    <>
      <PageHeader eyebrow="Outlook" title="What your records suggest is coming"
        description="Estimates from your own records, with the range, the reasons and how sure they are. Where there isn't enough data, Foundry says so instead of guessing." />
      <form action={refreshOutlook} className="mb-4"><input type="hidden" name="businessId" value={bid} /><Button size="sm">Refresh outlook</Button></form>
      {!forecasts.length && <p className="glass p-6 text-sm text-muted-foreground">No outlook yet. Refresh to create one.</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        {forecasts.map((f, i) => {
          const inputs = f.inputs as { product?: string; solution?: string };
          return (
            <Card key={f.id} aria-label={TITLE[f.kind] + (inputs.product ? `: ${inputs.product}` : inputs.solution ? `: ${inputs.solution}` : "")}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">{TITLE[f.kind]}{inputs.product ? `: ${inputs.product}` : inputs.solution ? `: ${inputs.solution}` : ""}
                  <Badge tone={f.confidence === "high" ? "brand" : f.confidence === "insufficient" ? "attention" : "neutral"}>{f.confidence === "insufficient" ? "not enough data" : `${f.confidence} confidence`}</Badge></CardTitle>
                <CardDescription>{f.basis}</CardDescription>
              </CardHeader>
              {f.result ? <Headline kind={f.kind} r={f.result as R} cur={business.currency} /> : <p className="text-sm">{f.request}</p>}
              {f.result && f.request && <p className="mt-1 text-xs text-muted-foreground">{f.request}</p>}
              <details className="mt-3 text-xs text-muted-foreground">
                <summary className="cursor-pointer">Assumptions and method</summary>
                <ul className="mt-1 list-disc pl-4">{(f.assumptions as string[]).map((a) => <li key={a}>{a}</li>)}</ul>
                <p className="mt-1">{f.method} · {f.method_version} · as of {formatDate(f.as_of)} · <span data-testid="reproducible">{checks[i] ? "reproducible ✓" : "not reproducible"}</span></p>
              </details>
            </Card>
          );
        })}
      </div>
    </>
  );
}
