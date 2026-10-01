import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { acknowledgeIncident, detectIncidents } from "../actions";

export const metadata: Metadata = { title: "Control plane" };

type Plane = {
  period_days: number; generated_at: string; status: Record<string, "green" | "amber" | "red">;
  required_interventions: { area: string; action: string; link: string }[];
  areas: Record<string, Record<string, unknown>> & { incidents: { open: { id: string; severity: string; title: string; source: string; since: string; status: string }[] } };
};

const TONE = { green: "brand", amber: "opportunity", red: "attention" } as const;

function Kv({ data }: { data: Record<string, unknown> | null | undefined }) {
  if (!data) return <p className="text-xs text-muted-foreground">No data yet.</p>;
  return (
    <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
      {Object.entries(data).filter(([, v]) => v === null || typeof v !== "object").map(([k, v]) => (
        <div key={k} className="contents"><dt className="text-muted-foreground">{k.replaceAll("_", " ")}</dt><dd className="text-right tabular-nums">{v == null ? "—" : String(v)}</dd></div>
      ))}
    </dl>
  );
}

export default async function ControlPage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("control_plane", {});
  const p = data as unknown as Plane;
  const a = p.areas;
  const tiles: [string, string, Record<string, unknown> | undefined][] = [
    ["Growth", "growth", a.growth], ["Operators", "operators", a.operators], ["Partners", "partners", a.partners],
    ["Solutions", "solutions", (a.solutions as { funnel?: Record<string, unknown> })?.funnel], ["Outcomes (USD, verified)", "outcomes", (a.outcomes as { impact_usd?: Record<string, unknown> })?.impact_usd],
    ["Economics (USD)", "economics", a.economics], ["Data quality", "data_quality", a.data_quality], ["Policy", "policy", a.policy],
  ];
  return (
    <>
      <PageHeader eyebrow="Admin" title="Control plane" description={`Where value is created, what is failing, what it costs, and what needs a decision — last ${p.period_days} days, from live data.`} />
      <div className="mb-4 flex flex-wrap items-center gap-2" aria-label="Status">
        {Object.entries(p.status).map(([k, v]) => <Badge key={k} tone={TONE[v]} data-testid={`status-${k}`}>{k}: {v}</Badge>)}
        <form action={detectIncidents}><Button size="sm" variant="outline">Detect incidents</Button></form>
      </div>
      <Card className="mb-6" aria-label="Required interventions">
        <CardHeader><CardTitle>Needs a decision</CardTitle></CardHeader>
        <ul className="divide-y text-sm">{p.required_interventions.map((r, i) => (
          <li key={i} className="flex items-center gap-2 py-2"><Badge tone="neutral">{r.area.replace("_", " ")}</Badge><span className="flex-1">{r.action}</span>
            <a href={r.link} className="text-xs font-medium text-primary hover:underline">Open →</a></li>))}
          {!p.required_interventions.length && <li className="py-2 text-muted-foreground">Nothing needs a decision.</li>}</ul>
      </Card>
      <Card className="mb-6" aria-label="Incidents">
        <CardHeader><CardTitle>Incidents</CardTitle><CardDescription>Detected from jobs, webhooks, integrity, security, drift, policy, experiments and billing. They resolve when the signal clears.</CardDescription></CardHeader>
        <ul className="divide-y text-sm">{a.incidents.open.map((x) => (
          <li key={x.id} className="flex flex-wrap items-center gap-2 py-2" aria-label={`Incident ${x.title}`}>
            <Badge tone={x.severity === "critical" || x.severity === "high" ? "attention" : "neutral"}>{x.severity}</Badge>
            <span className="flex-1">{x.title} <span className="text-xs text-muted-foreground">· {x.source} · since {formatDate(x.since)}</span></span>
            {x.status === "open" ? <form action={acknowledgeIncident}><input type="hidden" name="id" value={x.id} /><Button size="sm" variant="ghost">Acknowledge</Button></form> : <Badge tone="neutral">{x.status}</Badge>}
          </li>))}
          {!a.incidents.open.length && <li className="py-2 text-muted-foreground">No open incidents.</li>}</ul>
      </Card>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {tiles.map(([title, key, d]) => (
          <Card key={key} aria-label={title}><CardHeader><CardTitle className="flex items-center gap-2">{title}
            {p.status[key] && <Badge tone={TONE[p.status[key]]}>{p.status[key]}</Badge>}</CardTitle></CardHeader><Kv data={d} /></Card>
        ))}
      </div>
    </>
  );
}
