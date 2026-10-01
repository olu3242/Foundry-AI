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

export default async function PilotPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUser(`/pilots/${id}`);
  const supabase = await createClient();
  const [{ data, error }, { data: isAdmin }] = await Promise.all([supabase.rpc("pilot_report", { p_pilot_id: id }), supabase.rpc("am_platform_admin")]);
  if (error || !data) notFound();
  const r = data as unknown as Report;
  const p = r.pilot;
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
