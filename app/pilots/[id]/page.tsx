import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { SimpleShell } from "@/components/shell/simple-shell";
import { PageHeader } from "@/components/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { InviteForm, OperatorForm } from "@/components/pilots/forms";
import { GapForm, GapUpdateForm, OfferForm, OperatorPulseForm, TouchForm } from "@/components/pilots/field";
import { advancePilots, setPilotStatus } from "../actions";

export const metadata: Metadata = { title: "Pilot" };

type Report = {
  pilot: { id: string; name: string; status: string; program: string; join_code: string; sponsor: string | null; support_owner: string | null; country_code: string | null;
    sector: string | null; target_size: number; starts_on: string; ends_on: string; day: number; length_days: number; escalation_days: number; consent_version: string; intervention_scope: string[] };
  operators: { name: string; role: string }[]; calendar: { day: number; label: string; date: string; done: boolean }[];
  invited: number; invites_accepted: number; funnel: { stage: string; real: number; test: number }[];
  ineligible: Record<string, number>; failure_reasons: Record<string, number>; median_days_to_activation: number | null;
  businesses: { business_id: string; name: string; class: string; stage: string; eligible: boolean; ineligible_reason: string | null; at_risk: boolean; last_activity_at: string | null; failure_reason: string | null }[];
  success_metrics: { key: string; target: number; value: number | null; met: boolean | null }[];
  evidence: { real_businesses: number; test_businesses: number; verified_outcomes: number; requirements_met: boolean };
};

type M = { value: number | null; state: string };
type Portfolio = { business_id: string; name: string; class: string; stage: string; at_risk: boolean; days_since_record: number | null; unconfirmed_drafts: number;
  pulse_alerts: number; open_escalations: number; active_interventions: number; outcomes_to_verify: number; last_touch_at: string | null; attention: number }[];

const TILES: [string, string][] = [["invited", "Invited"], ["activated", "Activated"], ["capture_success", "Capture success"], ["verification", "Verified records"],
  ["useful_pulse", "Useful Pulse"], ["interventions", "Interventions"], ["completion", "Completion"], ["measured_outcomes", "Measured outcomes"],
  ["verified_outcomes", "Verified outcomes"], ["passport_progress", "Passport progress"], ["operator_load", "Businesses / operator"],
  ["operator_minutes_per_business", "Operator min / business"], ["retention", "Retention"], ["revenue_usd", "Revenue (USD)"], ["cost_usd", "Cost (USD)"],
  ["contribution_usd", "Contribution (USD)"], ["time_to_value_days", "Days to value"], ["time_to_verified_outcome_days", "Days to verified outcome"]];
const show = (m?: M) => (!m ? "—" : m.state === "value" || m.state === "0" ? String(m.value) : m.state);

export default async function PilotPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUser(`/pilots/${id}`);
  const supabase = await createClient();
  const [{ data, error }, { data: isAdmin }] = await Promise.all([supabase.rpc("pilot_report", { p_pilot_id: id }), supabase.rpc("am_platform_admin")]);
  if (error || !data) notFound();
  const r = data as unknown as Report;
  const p = r.pilot;
  const user = await requireUser(`/pilots/${id}`);
  const [{ data: dash }, { data: portfolio }, { data: gaps }, { data: mine }, { data: plans }] = await Promise.all([
    supabase.rpc("pilot_dashboard", { p_pilot_id: id }),
    supabase.rpc("operator_portfolio", { p_pilot_id: id }),
    supabase.from("pilot_gaps").select("*").eq("pilot_id", id).order("created_at", { ascending: false }),
    supabase.from("pilot_operators").select("role").eq("pilot_id", id).eq("user_id", user.id),
    supabase.from("billing_plans").select("key, name").eq("payer_kind", "business").eq("status", "active").gt("price_minor", 0),
  ]);
  const d = (dash ?? {}) as Record<string, M> & { real_businesses: number; test_businesses_excluded: number; record_maturity: Record<string, number> & { state?: string } };
  const isOperator = (mine ?? []).some((m) => m.role === "operator");
  const rows = (portfolio ?? []) as unknown as Portfolio;
  return (
    <SimpleShell>
      <PageHeader eyebrow={`Pilot · ${p.program}`} title={p.name}
        description={`Day ${p.day} of ${p.length_days} · ${p.country_code ?? "any market"}${p.sector ? ` · ${p.sector}` : ""} · cohort ${p.target_size} · join code ${p.join_code} · consent ${p.consent_version}`} />
      <div className="mb-6 flex flex-wrap items-center gap-2 text-sm">
        <Badge tone={p.status === "active" ? "brand" : "neutral"} data-testid="pilot-status">{p.status}</Badge>
        {isAdmin && p.status === "draft" && <form action={setPilotStatus}><input type="hidden" name="id" value={id} /><input type="hidden" name="status" value="active" /><Button size="sm">Start pilot</Button></form>}
        {isAdmin && p.status === "active" && <form action={setPilotStatus}><input type="hidden" name="id" value={id} /><input type="hidden" name="status" value="completed" /><Button size="sm" variant="outline">Complete</Button></form>}
        {isAdmin && <form action={advancePilots}><input type="hidden" name="id" value={id} /><Button size="sm" variant="outline">Update stages now</Button></form>}
        <span className="text-xs text-muted-foreground">Stages also update every day automatically.</span>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card aria-label="Funnel">
          <CardHeader><CardTitle>Funnel</CardTitle><CardDescription>Invited {r.invited} · accepted {r.invites_accepted} · median days to activation {r.median_days_to_activation ?? "—"}</CardDescription></CardHeader>
          <table className="w-full text-sm"><thead><tr className="text-left text-xs text-muted-foreground"><th>Reached</th><th>Real</th><th>Test data</th></tr></thead>
            <tbody>{r.funnel.map((f) => <tr key={f.stage} aria-label={`Stage ${f.stage}`}><td>{f.stage}</td><td data-testid="real">{f.real}</td><td className="text-muted-foreground" data-testid="test">{f.test}</td></tr>)}</tbody></table>
        </Card>
        <Card aria-label="Success metrics">
          <CardHeader><CardTitle className="flex items-center gap-2">Success and evidence <Badge tone={r.evidence.requirements_met ? "brand" : "attention"} data-testid="evidence-met">
            {r.evidence.requirements_met ? "Evidence requirements met" : "Evidence not yet sufficient"}</Badge></CardTitle>
            <CardDescription>Real businesses {r.evidence.real_businesses} · test-data businesses {r.evidence.test_businesses} (never counted) · verified outcomes {r.evidence.verified_outcomes}</CardDescription></CardHeader>
          <ul className="space-y-1 text-sm">{r.success_metrics.map((m) => (
            <li key={m.key} aria-label={`Metric ${m.key}`}>{m.key.replaceAll("_", " ")}: <b>{m.value ?? "no real data"}</b> / target {m.target} {m.met ? "✓" : ""}</li>))}</ul>
        </Card>
        <Card aria-label="Calendar">
          <CardHeader><CardTitle>Calendar</CardTitle><CardDescription>{p.starts_on} → {p.ends_on} · escalate after {p.escalation_days} quiet days · support: {p.support_owner ?? "not set"}</CardDescription></CardHeader>
          <ul className="space-y-1 text-sm">{r.calendar.map((c) => <li key={c.day} className={c.done ? "text-muted-foreground" : ""}>Day {c.day} · {c.date} · {c.label}</li>)}</ul>
        </Card>
        <Card aria-label="Team">
          <CardHeader><CardTitle>Operators and sponsor</CardTitle><CardDescription>Sponsor: {r.pilot.sponsor ?? "—"}</CardDescription></CardHeader>
          <ul className="mb-3 text-sm">{r.operators.map((o, i) => <li key={i}>{o.name} · {o.role}</li>)}</ul>
          {isAdmin && <OperatorForm id={id} />}
        </Card>
      </div>
      <Card className="mt-6" aria-label="Pilot dashboard">
        <CardHeader><CardTitle>Pilot dashboard</CardTitle>
          <CardDescription>Real businesses {d.real_businesses ?? 0} · test data excluded {d.test_businesses_excluded ?? 0}. 0 = measured zero · N/A = does not apply · UNKNOWN = not captured · INSUFFICIENT_EVIDENCE = no real businesses.</CardDescription></CardHeader>
        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
          {TILES.map(([k, label]) => (
            <div key={k} className="rounded-xl border p-3" aria-label={`Tile ${k}`}><dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="font-semibold" data-testid="tile-value">{show(d[k])}</dd></div>))}
          <div className="rounded-xl border p-3" aria-label="Tile record_maturity"><dt className="text-xs text-muted-foreground">Record maturity</dt>
            <dd className="font-semibold" data-testid="tile-value">{d.record_maturity?.state ?? (["R0", "R1", "R2", "R3"].map((l) => `${l} ${d.record_maturity?.[l] ?? 0}`).join(" · "))}</dd></div>
        </dl>
      </Card>
      <Card className="mt-6" aria-label="Portfolio">
        <CardHeader><CardTitle>{isOperator ? "My portfolio" : "Portfolio"}</CardTitle>
          <CardDescription>Everything that needs a person, most urgent first. Routine reminders are sent automatically; log what you do so operator effort is measured.</CardDescription></CardHeader>
        <ul className="divide-y text-sm">{rows.map((b) => (
          <li key={b.business_id} className="space-y-2 py-3" aria-label={`Portfolio ${b.name}`}>
            <p className="flex flex-wrap items-center gap-2"><a className="font-medium hover:underline" href={`/b/${b.business_id}`}>{b.name}</a>
              {b.class === "test" && <span className="text-xs text-muted-foreground">test data</span>}
              <Badge tone="trust">{b.stage}</Badge>{b.at_risk && <Badge tone="attention">at risk</Badge>}
              <span className="text-xs text-muted-foreground" data-testid="attention">
                {b.days_since_record == null ? "no records yet" : `last record ${b.days_since_record}d ago`} · drafts {b.unconfirmed_drafts} · Pulse alerts {b.pulse_alerts} · escalations {b.open_escalations}
                · plans {b.active_interventions} · results to verify {b.outcomes_to_verify}</span></p>
            {(isOperator || isAdmin) && <TouchForm id={id} businessId={b.business_id} />}
            {isOperator && <OperatorPulseForm id={id} businessId={b.business_id} />}
            {(isOperator || isAdmin) && <OfferForm id={id} businessId={b.business_id} plans={plans ?? []} />}
          </li>))}
          {!rows.length && <li className="py-2 text-muted-foreground">No businesses assigned yet.</li>}</ul>
      </Card>
      <Card className="mt-6" aria-label="Pilot gaps">
        <CardHeader><CardTitle>Pilot gaps</CardTitle><CardDescription>Field problems become structured gaps. Only P0/P1 interrupt the pilot; P2/P3 may be backlogged.</CardDescription></CardHeader>
        <ul className="mb-4 divide-y text-sm">{(gaps ?? []).map((g) => (
          <li key={g.gap_id} className="py-2" aria-label={`Gap ${g.gap_id}`}>
            <span className="font-mono text-xs">{g.gap_id}</span> · {g.batch} · <Badge tone={g.severity === "P0" || g.severity === "P1" ? "attention" : "neutral"}>{g.severity}</Badge> {g.problem}
            <span className="block text-xs text-muted-foreground">Evidence: {g.evidence} · status <b data-testid="gap-status">{g.status}</b>{g.root_cause ? ` · cause: ${g.root_cause}` : ""}{g.resolution ? ` · ${g.resolution}` : ""}</span>
            {!["resolved", "wont_fix"].includes(g.status) && <GapUpdateForm id={id} gapId={g.gap_id} />}
          </li>))}
          {!gaps?.length && <li className="py-2 text-muted-foreground">No gaps recorded.</li>}</ul>
        <GapForm id={id} />
      </Card>
      <Card className="mt-6" aria-label="Businesses">
        <CardHeader><CardTitle>Businesses</CardTitle><CardDescription>At-risk first. Ineligible: {Object.entries(r.ineligible).map(([k, v]) => `${k} ${v}`).join(" · ") || "none"} · Failure reasons: {Object.entries(r.failure_reasons).map(([k, v]) => `${k.replaceAll("_", " ")} ${v}`).join(" · ") || "none"}</CardDescription></CardHeader>
        <ul className="divide-y text-sm">{r.businesses.map((b) => (
          <li key={b.business_id} className="flex flex-wrap items-center gap-2 py-2" aria-label={`Pilot business ${b.name}`}>
            <span className="flex-1">{b.name}{b.class === "test" && <span className="text-xs text-muted-foreground"> · test data</span>}
              <span className="block text-xs text-muted-foreground">{b.eligible ? `Last activity ${b.last_activity_at ? formatDate(b.last_activity_at) : "never"}` : `Not eligible: ${b.ineligible_reason}`}{b.failure_reason ? ` · ${b.failure_reason.replaceAll("_", " ")}` : ""}</span></span>
            {b.at_risk && <Badge tone="attention">at risk</Badge>}<Badge tone="trust" data-testid="stage">{b.stage}</Badge>
          </li>))}
          {!r.businesses.length && <li className="py-2 text-muted-foreground">No businesses yet. Share join code {p.join_code}.</li>}</ul>
      </Card>
      <Card className="mt-6"><CardHeader><CardTitle>Invite owners</CardTitle></CardHeader><InviteForm id={id} /></Card>
    </SimpleShell>
  );
}
