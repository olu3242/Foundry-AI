import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { ExperimentForm } from "@/components/admin/experiment-form";
import { formatDate } from "@/lib/utils";
import { evaluateExperiments, publishVariant, setExperimentStatus } from "../actions";

export const metadata: Metadata = { title: "Experiments" };

type Arm = { assigned: number; started: number; completed: number; improved: number; improved_rate: number | null; completion_rate: number | null; abandon_rate: number | null };
type Report = { current: { arms: Record<string, Arm>; decision: string; difference: number | null; ci95: [number, number] | null; p_value: number | null; note: string } | null;
  history: { at: string; decision: string; difference: number | null }[] };

export default async function ExperimentsPage() {
  const supabase = await createClient();
  const [{ data: experiments }, { data: solutions }] = await Promise.all([
    supabase.from("experiments").select("id, key, name, hypothesis, status, conclusion, started_at, primary_metric").order("created_at", { ascending: false }),
    supabase.from("solutions").select("id, name, solution_versions(id, version, status)").eq("status", "active").is("provider_id", null).order("name"),
  ]);
  const reports = await Promise.all((experiments ?? []).map(async (e) => (await supabase.rpc("experiment_report", { p_id: e.id })).data as unknown as Report));
  const sols = (solutions ?? []).map((s) => ({ id: s.id, name: s.name, versions: s.solution_versions.filter((v) => v.status === "active").sort((a, b) => a.version - b.version) }));

  return (
    <>
      <PageHeader eyebrow="Admin" title="Experiments" description="Randomized, sticky assignment of solution variants. Finance, eligibility, pricing, consent and legal decisions are never experimented on." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card aria-label="New experiment"><CardHeader><CardTitle>New experiment</CardTitle></CardHeader><ExperimentForm solutions={sols} /></Card>
        <Card aria-label="Publish a variant">
          <CardHeader><CardTitle>Publish a variant</CardTitle><CardDescription>A new version of a proven plan, to test against the current one.</CardDescription></CardHeader>
          <form action={publishVariant} className="space-y-2 text-sm">
            <Select name="solutionId" aria-label="Variant solution">{sols.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
            <textarea name="steps" aria-label="Steps (one per line)" rows={4} required className="w-full rounded-md border bg-transparent p-2 text-xs" />
            <Button size="sm" variant="outline">Publish version</Button>
          </form>
        </Card>
      </div>
      <form action={evaluateExperiments} className="my-4"><Button size="sm" variant="outline">Evaluate running experiments</Button></form>
      <div className="space-y-4">
        {experiments?.map((e, i) => {
          const r = reports[i];
          return (
            <Card key={e.id} aria-label={`Experiment ${e.key}`}>
              <CardHeader className="flex-row items-start justify-between gap-2">
                <div><CardTitle>{e.name} <Badge tone={e.status === "running" ? "brand" : "neutral"}>{e.status}</Badge></CardTitle>
                  <CardDescription>{e.hypothesis}{e.conclusion ? ` — ${e.conclusion}` : ""}</CardDescription></div>
                {e.status === "draft" && <form action={setExperimentStatus}><input type="hidden" name="id" value={e.id} /><input type="hidden" name="status" value="running" /><Button size="sm">Start</Button></form>}
                {e.status === "running" && <form action={setExperimentStatus}><input type="hidden" name="id" value={e.id} /><input type="hidden" name="status" value="stopped" /><Button size="sm" variant="outline">Stop</Button></form>}
              </CardHeader>
              {r?.current && (
                <>
                  <table className="w-full text-sm"><thead><tr className="text-left text-muted-foreground"><th>Arm</th><th>Assigned</th><th>Started</th><th>Completed</th><th>Improved</th><th>Abandon</th></tr></thead>
                    <tbody>{Object.entries(r.current.arms).map(([k, a]) => (
                      <tr key={k} data-testid={`arm-${k}`}><td>{k}</td><td>{a.assigned}</td><td>{a.started}</td><td>{a.completed}</td>
                        <td>{a.improved_rate == null ? "—" : `${Math.round(a.improved_rate * 100)}%`}</td><td>{a.abandon_rate == null ? "—" : `${Math.round(a.abandon_rate * 100)}%`}</td></tr>))}</tbody></table>
                  <p className="mt-2 text-sm">Decision: <b>{r.current.decision.replaceAll("_", " ")}</b>
                    {r.current.ci95 && ` · difference ${r.current.difference} (95% CI ${r.current.ci95[0]} to ${r.current.ci95[1]}) · p=${r.current.p_value}`}</p>
                  <p className="text-xs text-muted-foreground">{r.current.note}</p>
                </>
              )}
              {!!r?.history.length && <p className="mt-2 text-xs text-muted-foreground">History: {r.history.map((h) => `${formatDate(h.at)} ${h.decision}`).join(" · ")}</p>}
            </Card>
          );
        })}
      </div>
    </>
  );
}
