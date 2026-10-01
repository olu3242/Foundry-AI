import type { Metadata } from "next";
import { CheckCircle2, Circle, ShieldCheck } from "lucide-react";
import { requireBusiness } from "@/lib/auth/guards";
import { PageHeader } from "@/components/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { StartPlanForm } from "@/components/progress/start-plan-form";
import { formatMetric, metricLabel } from "@/lib/interventions/catalog";
import { LaunchPlaybook } from "@/components/progress/playbooks";
import { formatDate } from "@/lib/utils";
import { abandonPlan, completePlan, verifyResult } from "./actions";
import { SolutionList } from "@/components/progress/solution-list";
import { loadSolutions } from "@/lib/solutions";
import { AttributionForm, OutcomeContractForm } from "@/components/progress/contract-forms";

export const metadata: Metadata = { title: "Progress" };

const MILESTONES: { key: string; label: string }[] = [
  { key: "created", label: "Business set up" },
  { key: "first_capture", label: "First capture" },
  { key: "first_record", label: "First record in the books" },
  { key: "first_pulse", label: "First Pulse" },
  { key: "active_week", label: "Recorded on 7 different days" },
  { key: "first_intervention", label: "First plan started" },
  { key: "first_completed", label: "First plan completed" },
  { key: "first_verified_outcome", label: "First verified result" },
  { key: "first_passport_share", label: "Passport shared" },
];

export default async function ProgressPage({ params }: { params: Promise<{ bid: string }> }) {
  const { bid } = await params;
  const { business, role, supabase } = await requireBusiness(bid);
  const isVerifier = role === "partner" || role === "program_admin";
  const [solutions, { data: activation }, { data: plans }] = await Promise.all([
    loadSolutions(supabase, bid),
    supabase.rpc("activation_status", { p_business_id: bid }),
    supabase.from("interventions").select("*, outcomes(*), solution_engagements(id, providers(name), engagement_updates(note, created_at))").eq("business_id", bid).order("started_at", { ascending: false }).limit(30),
  ]);
  const a = (activation ?? {}) as Record<string, string | number | null>;
  const done = (key: string) => (key === "active_week" ? Number(a.active_days_30 ?? 0) >= 7 : Boolean(a[key]));
  const cur = business.currency;

  // B34: playbooks for detected problems, and runs in progress.
  const [{ data: suggestions }, { data: runs }] = await Promise.all([
    supabase.rpc("suggest_playbooks", { p_business_id: bid }),
    supabase.from("playbook_runs").select("id, playbook_key, status, current_step, result, stop_reason, playbooks(name), playbook_run_steps(step_no, solution_key, status)")
      .eq("business_id", bid).order("started_at", { ascending: false }).limit(5),
  ]);
  const suggested = (suggestions ?? []) as unknown as { key: string; name: string; why: string; steps: string[]; recurring: boolean }[];

  return (
    <>
      <PageHeader eyebrow="Progress" title="From records to results"
        description="Plans you run, what changed, and who has checked it. Results are measured from your own records; a partner confirms them." />
      <a href={`/b/${bid}/memory`} className="mb-4 mr-4 inline-block text-sm font-medium text-primary hover:underline">Your business history →</a>
      <a href={`/b/${bid}/decisions`} className="mb-4 inline-block text-sm font-medium text-primary hover:underline">How suggestions were weighed →</a>
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Start a plan</CardTitle><CardDescription>Pick one thing to change. Foundry records today&apos;s number and measures it again when the plan ends.</CardDescription></CardHeader>
            <StartPlanForm businessId={bid} />
          </Card>
          <Card>
            <CardHeader><CardTitle>Plans that have worked for others</CardTitle><CardDescription>Counts come from businesses that ran each plan. An improvement after a plan isn&apos;t proof the plan caused it.</CardDescription></CardHeader>
            <SolutionList businessId={bid} rows={solutions} canStart />
          </Card>
          {(suggested.length > 0 || !!runs?.length) && (
            <Card aria-label="Playbooks">
              <CardHeader><CardTitle>Playbooks</CardTitle><CardDescription>Several proven plans, one after another, for a problem that keeps coming back.</CardDescription></CardHeader>
              <ul className="space-y-3 text-sm">
                {suggested.map((p) => (
                  <li key={p.key} className="flex flex-wrap items-center gap-3" aria-label={`Playbook ${p.name}`}>
                    <span className="flex-1"><span className="font-medium">{p.name}</span>{p.recurring && <Badge tone="attention" className="ml-2">keeps coming back</Badge>}
                      <span className="block text-xs text-muted-foreground">{p.why} · {p.steps.join(" → ")}</span></span>
                    <LaunchPlaybook businessId={bid} playbook={p.key} />
                  </li>
                ))}
                {runs?.map((r) => {
                  const result = r.result as { improved?: boolean | null } | null;
                  return (
                    <li key={r.id} aria-label={`Playbook run ${r.playbooks?.name}`}>
                      <span className="font-medium">{r.playbooks?.name}</span> <Badge tone={r.status === "running" ? "opportunity" : "neutral"}>{r.status}</Badge>
                      {result && result.improved != null && <Badge tone={result.improved ? "brand" : "attention"} className="ml-1">{result.improved ? "improved" : "no improvement"}</Badge>}
                      <ol className="mt-1 flex flex-wrap gap-2 text-xs">{[...r.playbook_run_steps].sort((a, b) => a.step_no - b.step_no).map((st) => (
                        <li key={st.step_no} data-testid={`step-${st.step_no}`}>{st.step_no}. {st.solution_key.replaceAll("_", " ")}: {st.status}</li>))}</ol>
                      {r.stop_reason && <p className="text-xs text-muted-foreground">{r.stop_reason}</p>}
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
          {plans?.map((p) => {
            const o = Array.isArray(p.outcomes) ? p.outcomes[0] : p.outcomes;
            const metric = { label: metricLabel(p.target_metric) };
            return (
              <article key={p.id} className="glass space-y-3 p-4" aria-label={p.title}>
                <header className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold">{p.title}</h2>
                  {p.solution_version_id && <Badge tone="insight">Proven plan</Badge>}
                  <Badge tone={p.status === "active" ? "opportunity" : p.status === "completed" ? "brand" : "neutral"}>{p.status}</Badge>
                  <span className="ml-auto text-xs text-muted-foreground">Started {formatDate(p.started_at)} · ends {formatDate(p.due_at)}</span>
                </header>
                {(() => {
                  const e = Array.isArray(p.solution_engagements) ? p.solution_engagements[0] : p.solution_engagements;
                  if (!e) return null;
                  return (
                    <div className="rounded-xl bg-muted/50 p-3 text-xs" aria-label="Provider updates">
                      <p className="font-medium">With {e.providers?.name}</p>
                      {(e.engagement_updates as { note: string; created_at: string }[]).map((u, i) => <p key={i}>{formatDate(u.created_at)}: {u.note}</p>)}
                    </div>
                  );
                })()}
                <p className="text-sm text-muted-foreground">{metric?.label}: {formatMetric(p.target_metric, Number(p.baseline_value), cur)} at the start
                  {p.target_value != null && <span data-testid="contract"> · target {formatMetric(p.target_metric, Number(p.target_value), cur)}{p.contract_approved_at ? " (agreed)" : ""}</span>}</p>
                {p.status === "active" && p.target_value == null && role === "owner" && <OutcomeContractForm businessId={bid} id={p.id} />}
                {o && (
                  <div className="rounded-xl border p-3 text-sm">
                    <p>
                      Now {formatMetric(o.metric, Number(o.observed_value), cur)} ({Number(o.delta) >= 0 ? "+" : ""}{formatMetric(o.metric, Number(o.delta), cur)}) ·{" "}
                      <span className={o.improved ? "text-growth" : "text-orange-ink"}>{o.improved ? "improved" : "not improved yet"}</span>
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      {o.status === "verified" ? <><ShieldCheck className="size-3.5 text-growth" aria-hidden /> Verified by {o.verifier_role === "program_admin" ? "the program" : "your partner"}</>
                        : o.status === "disputed" ? "Questioned by your partner" : "Measured from your records, waiting for a partner to check"}
                    </p>
                    {o.status === "verified" && o.attribution !== "not_assessed" && (
                      <p className="mt-1 text-xs" data-testid="attribution">Attribution: {o.attribution === "likely" ? "the plan likely caused it" : o.attribution === "contributed" ? "the plan contributed" : "unlikely to be the plan"} · {o.attribution_note}</p>)}
                    {isVerifier && o.status === "verified" && o.attribution === "not_assessed" && <AttributionForm businessId={bid} id={o.id} />}
                    {isVerifier && o.status === "observed" && (
                      <div className="mt-2 flex gap-2">
                        {(["verified", "disputed"] as const).map((v) => (
                          <form key={v} action={verifyResult}>
                            <input type="hidden" name="businessId" value={bid} /><input type="hidden" name="id" value={o.id} /><input type="hidden" name="verdict" value={v} />
                            <Button size="sm" variant={v === "verified" ? "default" : "ghost"}>{v === "verified" ? "Verify result" : "Question it"}</Button>
                          </form>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {p.status === "active" && (
                  <div className="flex flex-wrap gap-2">
                    <form action={completePlan}><input type="hidden" name="businessId" value={bid} /><input type="hidden" name="id" value={p.id} /><Button size="sm">Mark done</Button></form>
                    <form action={abandonPlan} className="flex gap-2">
                      <input type="hidden" name="businessId" value={bid} /><input type="hidden" name="id" value={p.id} />
                      <Select name="reason" aria-label="Why stop" className="h-9 w-40 text-xs" defaultValue="not_relevant">
                        <option value="not_relevant">Not relevant</option><option value="too_hard">Too hard</option><option value="no_time">No time</option>
                        <option value="no_money">No money</option><option value="did_not_work">Didn&apos;t work</option><option value="other">Other</option>
                      </Select>
                      <Button size="sm" variant="ghost">Stop</Button>
                    </form>
                  </div>
                )}
              </article>
            );
          })}
        </div>
        <Card className="h-fit">
          <CardHeader><CardTitle>Getting started</CardTitle></CardHeader>
          <ol className="space-y-2 text-sm" aria-label="Activation checklist">
            {MILESTONES.map((m) => (
              <li key={m.key} className="flex items-center gap-2">
                {done(m.key) ? <CheckCircle2 className="size-4 text-growth" aria-label="Done" /> : <Circle className="size-4 text-muted-foreground" aria-label="Not yet" />}
                <span className={done(m.key) ? "" : "text-muted-foreground"}>{m.label}</span>
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </>
  );
}
