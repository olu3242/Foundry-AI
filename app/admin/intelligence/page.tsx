import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Intelligence quality" };

type Q = {
  pulse: { at_risk_precision: number | null; false_positive_rate: number | null; feedback: number };
  extraction: { model: string; drafts: number; edit_rate: number | null; reject_rate: number | null }[];
  recommendations: { generator: string; shown: number; acceptance_rate: number | null; completion_rate: number | null; verified_rate: number | null }[];
  forecasts: { evaluated: number; unknown_actuals: number; interval_coverage: number | null; target_coverage: number; mape: number | null };
  decisions: { decisions: number; acceptance_rate: number | null; override_rate: number | null; improved_when_accepted: number | null; improved_when_overridden: number | null };
  drift_alerts: { scope: string; subject: string; on: string }[]; note: string;
};
const pct = (v: number | null | undefined) => (v == null ? "—" : `${Math.round(v * 100)}%`);

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className="text-xl font-semibold" data-testid={`iq-${label}`}>{value}</p>{sub && <p className="text-xs text-muted-foreground">{sub}</p>}</div>;
}

export default async function IntelligencePage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("intelligence_quality", { p_days: 90 });
  const q = data as unknown as Q;
  return (
    <>
      <PageHeader eyebrow="Admin" title="Intelligence quality" description={`Objective measures for every intelligence capability, last 90 days. ${q.note}`} />
      {!!q.drift_alerts.length && <div className="mb-4 flex flex-wrap gap-2" aria-label="Drift alerts">{q.drift_alerts.map((d) => <Badge key={d.scope + d.subject + d.on} tone="attention">drift: {d.scope} · {d.subject}</Badge>)}</div>}
      <div className="grid gap-4 md:grid-cols-2">
        <Card aria-label="Pulse"><CardHeader><CardTitle>Pulse</CardTitle><CardDescription>From owner feedback on at-risk signals ({q.pulse.feedback} responses).</CardDescription></CardHeader>
          <div className="flex gap-6"><Metric label="Precision" value={pct(q.pulse.at_risk_precision)} /><Metric label="False positives" value={pct(q.pulse.false_positive_rate)} /></div></Card>
        <Card aria-label="Forecasts"><CardHeader><CardTitle>Forecasts</CardTitle><CardDescription>Backtests of sales outlooks whose horizon has passed.</CardDescription></CardHeader>
          <div className="flex gap-6"><Metric label="Interval coverage" value={pct(q.forecasts.interval_coverage)} sub={`target ${pct(q.forecasts.target_coverage)}`} />
            <Metric label="MAPE" value={pct(q.forecasts.mape)} /><Metric label="Evaluated" value={String(q.forecasts.evaluated)} sub={`${q.forecasts.unknown_actuals} unknown actuals`} /></div></Card>
        <Card aria-label="Decisions"><CardHeader><CardTitle>Decision support</CardTitle><CardDescription>{q.decisions.decisions} decisions.</CardDescription></CardHeader>
          <div className="flex flex-wrap gap-6"><Metric label="Accepted" value={pct(q.decisions.acceptance_rate)} /><Metric label="Overridden" value={pct(q.decisions.override_rate)} />
            <Metric label="Improved when accepted" value={pct(q.decisions.improved_when_accepted)} /><Metric label="Improved when overridden" value={pct(q.decisions.improved_when_overridden)} /></div></Card>
        <Card aria-label="Extraction and recommendations"><CardHeader><CardTitle>Extraction & recommendations</CardTitle></CardHeader>
          <ul className="space-y-1 text-sm">
            {q.extraction.map((e) => <li key={e.model}>{e.model}: {e.drafts} drafts · edited {pct(e.edit_rate)} · rejected {pct(e.reject_rate)}</li>)}
            {q.recommendations.map((r) => <li key={r.generator}>{r.generator}: {r.shown} shown · accepted {pct(r.acceptance_rate)} · completed {pct(r.completion_rate)} · verified {pct(r.verified_rate)}</li>)}
            {!q.extraction.length && !q.recommendations.length && <li className="text-muted-foreground">No data yet.</li>}
          </ul></Card>
      </div>
    </>
  );
}
