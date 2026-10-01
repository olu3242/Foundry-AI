import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { SimpleShell } from "@/components/shell/simple-shell";
import { PageHeader } from "@/components/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { OrgForm } from "@/components/orgs/forms";

export const metadata: Metadata = { title: "Organization" };

type Report = { organization: { name: string; sla: { verify_hours: number; escalation_hours: number } }; boundary: string; totals: { programs: number; enrolled: number };
  programs: { id: string; name: string; sandbox: boolean; report: { enrolled: number; active_30d: number; outcomes: { verified_improved: number } };
    sla: { verify_hours_median: number | null; verify_breaches: number; escalation_hours_median: number | null; escalation_breaches: number } }[] };

export default async function OrgPage({ params }: { params: Promise<{ oid: string }> }) {
  const { oid } = await params;
  const user = await requireUser(`/orgs/${oid}`);
  const supabase = await createClient();
  const [{ data: me }, { data }, { data: myPrograms }, { data: plans }] = await Promise.all([
    supabase.from("org_members").select("role").eq("org_id", oid).eq("user_id", user.id).maybeSingle(),
    supabase.rpc("org_report", { p_org_id: oid }),
    supabase.from("program_members").select("program_id, programs(name, organization_id)").eq("user_id", user.id).eq("role", "admin"),
    supabase.from("billing_plans").select("key, name").eq("payer_kind", "sponsor").eq("status", "active"),
  ]);
  if (!me || !data) notFound();
  const r = data as unknown as Report;
  const admin = me.role === "owner" || me.role === "admin";
  const attachable = (myPrograms ?? []).filter((p) => p.programs && p.programs.organization_id !== oid);
  return (
    <SimpleShell>
      <PageHeader eyebrow={`Organization · ${me.role}`} title={r.organization.name} description={r.boundary} />
      <Card className="mb-6" aria-label="Programs">
        <CardHeader><CardTitle>{r.totals.programs} programs · {r.totals.enrolled} businesses</CardTitle>
          <CardDescription>SLA: verify results within {r.organization.sla.verify_hours}h, resolve escalations within {r.organization.sla.escalation_hours}h.</CardDescription></CardHeader>
        <table className="w-full text-sm"><thead><tr className="text-left text-xs text-muted-foreground"><th>Program</th><th>Enrolled</th><th>Active 30d</th><th>Verified improvements</th><th>Verify median (h)</th><th>SLA breaches</th></tr></thead>
          <tbody>{r.programs.map((p) => (
            <tr key={p.id} data-testid={`org-program-${p.name}`}><td>{p.name}{p.sandbox ? " (sandbox)" : ""}</td><td>{p.report.enrolled}</td><td>{p.report.active_30d}</td>
              <td>{p.report.outcomes.verified_improved}</td><td>{p.sla.verify_hours_median ?? "—"}</td><td>{p.sla.verify_breaches + p.sla.escalation_breaches}</td></tr>))}</tbody></table>
      </Card>
      {admin && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card><CardHeader><CardTitle>Programs</CardTitle></CardHeader>
            <OrgForm orgId={oid} op="attach" label="Attach program">
              <Select name="programId" aria-label="Program to attach" className="h-9 w-56 text-xs">{attachable.map((p) => <option key={p.program_id} value={p.program_id}>{p.programs?.name}</option>)}</Select>
            </OrgForm>
            <div className="mt-4"><OrgForm orgId={oid} op="delegate" label="Delegate role">
              <Select name="programId" aria-label="Program" className="h-9 w-44 text-xs">{r.programs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
              <Input name="contact" aria-label="Delegate phone or email" placeholder="Phone or email" required className="h-9 w-44 text-xs" />
              <Select name="role" aria-label="Program role" className="h-9 w-28 text-xs"><option value="admin">Admin</option><option value="partner">Partner</option></Select>
            </OrgForm></div>
          </Card>
          <Card><CardHeader><CardTitle>People</CardTitle><CardDescription>Analysts and auditors see aggregates only.</CardDescription></CardHeader>
            <OrgForm orgId={oid} op="member" label="Add member">
              <Input name="contact" aria-label="Member phone or email" placeholder="Phone or email" required className="h-9 w-48 text-xs" />
              <Select name="role" aria-label="Organization role" className="h-9 w-28 text-xs"><option value="analyst">Analyst</option><option value="auditor">Auditor</option><option value="admin">Admin</option></Select>
            </OrgForm>
          </Card>
          <Card><CardHeader><CardTitle>Sponsorship</CardTitle><CardDescription>Applies to every program in the organization.</CardDescription></CardHeader>
            <OrgForm orgId={oid} op="sponsor" label="Apply to all programs">
              <Select name="plan" aria-label="Sponsored plan" className="h-9 w-56 text-xs"><option value="">No sponsorship</option>{plans?.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}</Select>
            </OrgForm>
          </Card>
          <Card><CardHeader><CardTitle>Service levels</CardTitle></CardHeader>
            <OrgForm orgId={oid} op="sla" label="Save SLA">
              <Input name="verify_hours" type="number" min={1} defaultValue={r.organization.sla.verify_hours} aria-label="Verify within (hours)" className="h-9 w-24 text-xs" />
              <Input name="escalation_hours" type="number" min={1} defaultValue={r.organization.sla.escalation_hours} aria-label="Resolve escalations within (hours)" className="h-9 w-24 text-xs" />
            </OrgForm>
          </Card>
        </div>
      )}
    </SimpleShell>
  );
}
