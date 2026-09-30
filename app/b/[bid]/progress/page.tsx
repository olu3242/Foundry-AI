import type { Metadata } from "next";
import { CheckCircle2, Circle, ShieldCheck } from "lucide-react";
import { requireBusiness } from "@/lib/auth/guards";
import { PageHeader } from "@/components/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { StartPlanForm } from "@/components/progress/start-plan-form";
import { METRICS, formatMetric, type MetricKey } from "@/lib/interventions/catalog";
import { formatDate } from "@/lib/utils";
import { abandonPlan, completePlan, verifyResult } from "./actions";
import { SolutionList } from "@/components/progress/solution-list";
import { loadSolutions } from "@/lib/solutions";

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
    loadSolutions(supabase),
    supabase.rpc("activation_status", { p_business_id: bid }),
    supabase.from("interventions").select("*, outcomes(*)").eq("business_id", bid).order("started_at", { ascending: false }).limit(30),
  ]);
  const a = (activation ?? {}) as Record<string, string | number | null>;
  const done = (key: string) => (key === "active_week" ? Number(a.active_days_30 ?? 0) >= 7 : Boolean(a[key]));
  const cur = business.currency;

  return (
    <>
      <PageHeader eyebrow="Progress" title="From records to results"
        description="Plans you run, what changed, and who has checked it. Results are measured from your own records; a partner confirms them." />
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
          {plans?.map((p) => {
            const o = Array.isArray(p.outcomes) ? p.outcomes[0] : p.outcomes;
            const metric = METRICS[p.target_metric as MetricKey];
            return (
              <article key={p.id} className="glass space-y-3 p-4" aria-label={p.title}>
                <header className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold">{p.title}</h2>
                  {p.solution_version_id && <Badge tone="insight">Proven plan</Badge>}
                  <Badge tone={p.status === "active" ? "opportunity" : p.status === "completed" ? "brand" : "neutral"}>{p.status}</Badge>
                  <span className="ml-auto text-xs text-muted-foreground">Started {formatDate(p.started_at)} · ends {formatDate(p.due_at)}</span>
                </header>
                <p className="text-sm text-muted-foreground">{metric?.label}: {formatMetric(p.target_metric, Number(p.baseline_value), cur)} at the start</p>
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
