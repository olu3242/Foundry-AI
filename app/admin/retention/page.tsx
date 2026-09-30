import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { runRoutineOps, scanRetention } from "../actions";

export const metadata: Metadata = { title: "Retention" };

type Overview = {
  risk: Record<string, number>; stage: Record<string, number>; continuation: Record<string, number>;
  recovery: { action_type: string; n: number; recovered: number; lapsed: number; open: number; recovery_rate: number | null }[];
};

function Counts({ label, data }: { label: string; data: Record<string, number> }) {
  return (
    <Card aria-label={label}>
      <CardHeader><CardTitle>{label}</CardTitle></CardHeader>
      <ul className="space-y-1 text-sm">{Object.entries(data).map(([k, v]) => <li key={k} className="flex justify-between"><span>{k.replace("_", " ")}</span><span data-testid={`${label}-${k}`}>{v}</span></li>)}
        {!Object.keys(data).length && <li className="text-muted-foreground">No scan yet.</li>}</ul>
    </Card>
  );
}

export default async function RetentionPage() {
  const supabase = await createClient();
  const [{ data }, { data: auto }] = await Promise.all([supabase.rpc("retention_overview"), supabase.rpc("automation_overview", {})]);
  const o = data as unknown as Overview;
  const a = auto as unknown as { actions: { action_type: string; n: number; executed: number; awaiting: number; reverted: number }[]; escalations: Record<string, number>; automation_ratio: number | null };
  return (
    <>
      <PageHeader eyebrow="Admin" title="Retention" description="Health is measured by business value (records kept, plans completed, verified results), not app opens. Recovery actions carry the evidence that triggered them." />
      <div className="mb-4 flex gap-2">
        <form action={scanRetention}><Button size="sm">Scan now</Button></form>
        <form action={runRoutineOps}><Button size="sm" variant="outline">Run routine ops</Button></form>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Counts label="Risk" data={o.risk} /><Counts label="Stage" data={o.stage} /><Counts label="Continuation" data={o.continuation} />
      </div>
      <Card className="mt-6" aria-label="Recovery effectiveness">
        <CardHeader><CardTitle>Recovery effectiveness</CardTitle><CardDescription>Recovered = activity resumed after the action. Association, not proof the action caused it.</CardDescription></CardHeader>
        <table className="w-full text-sm"><thead><tr className="text-left text-muted-foreground"><th>Action</th><th>Opened</th><th>Open</th><th>Recovered</th><th>Lapsed</th><th>Rate</th></tr></thead>
          <tbody>{o.recovery.map((r) => (
            <tr key={r.action_type}><td>{r.action_type.replace("_", " ")}</td><td>{r.n}</td><td>{r.open}</td><td>{r.recovered}</td><td>{r.lapsed}</td>
              <td>{r.recovery_rate == null ? "—" : `${Math.round(r.recovery_rate * 100)}%`}</td></tr>))}</tbody></table>
      </Card>
      <Card className="mt-6" aria-label="Automation">
        <CardHeader><CardTitle>Routine automation (30 days)</CardTitle>
          <CardDescription>Bounded, reversible work done under each business&apos;s autonomy level; anything unusual is escalated to a person.
            {a.automation_ratio != null && ` ${a.automation_ratio} automated steps per escalation.`}</CardDescription></CardHeader>
        <table className="w-full text-sm"><thead><tr className="text-left text-muted-foreground"><th>Action</th><th>Total</th><th>Done automatically</th><th>Awaiting approval</th><th>Undone</th></tr></thead>
          <tbody>{a.actions.map((r) => <tr key={r.action_type}><td>{r.action_type}</td><td>{r.n}</td><td>{r.executed}</td><td>{r.awaiting}</td><td>{r.reverted}</td></tr>)}</tbody></table>
        <p className="mt-3 text-xs text-muted-foreground">Escalations: {Object.entries(a.escalations).map(([k, v]) => `${k} ${v}`).join(" · ") || "none"}</p>
      </Card>
    </>
  );
}
