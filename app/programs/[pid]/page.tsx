import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CreditCard } from "lucide-react";
import { requireUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { SimpleShell } from "@/components/shell/simple-shell";
import { PageHeader } from "@/components/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { AddMemberForm, InviteForm, ProgramSettingsForm } from "@/components/programs/forms";
import { ProgramReport, type Report } from "@/components/programs/program-report";
import { publicEnv } from "@/lib/env";
import { PortfolioTable } from "@/components/programs/portfolio-table";
import { loadPortfolio } from "@/lib/programs/portfolio";
import { billingConfigured } from "@/lib/billing/stripe";
import { formatDate } from "@/lib/utils";
import { assignPartner, startCheckout } from "../actions";

export const metadata: Metadata = { title: "Program" };

export default async function ProgramPage({ params, searchParams }: { params: Promise<{ pid: string }>; searchParams: Promise<{ billing?: string }> }) {
  const { pid } = await params;
  const { billing } = await searchParams;
  const user = await requireUser(`/programs/${pid}`);
  const supabase = await createClient();
  const [{ data: program }, { data: me }] = await Promise.all([
    supabase.from("programs").select("*").eq("id", pid).maybeSingle(),
    supabase.from("program_members").select("role").eq("program_id", pid).eq("user_id", user.id).maybeSingle(),
  ]);
  if (!program || !me) notFound();
  const isAdmin = me.role === "admin";

  const [{ data: enrollments }, { data: members }, { data: assignments }] = await Promise.all([
    supabase.from("program_enrollments").select("business_id, enrolled_at, status").eq("program_id", pid).eq("status", "active"),
    isAdmin ? supabase.from("program_members").select("user_id, role, profiles(full_name, email, phone)").eq("program_id", pid) : Promise.resolve({ data: [] }),
    supabase.from("partner_assignments").select("partner_user_id, business_id").eq("program_id", pid),
  ]);
  const { data: report } = isAdmin ? await supabase.rpc("program_report", { p_program_id: pid }) : { data: null };
  const since = Object.fromEntries((enrollments ?? []).map((e) => [e.business_id, e.enrolled_at]));
  const rows = await loadPortfolio(supabase, Object.keys(since), since);
  const partners = (members ?? []).filter((m) => m.role === "partner");
  const name = (m: (typeof partners)[number]) => m.profiles?.full_name || m.profiles?.email || (m.profiles?.phone ? `+${m.profiles.phone}` : "Partner");
  const paid = program.subscription_status === "active" || program.subscription_status === "trialing";

  return (
    <SimpleShell>
      <PageHeader eyebrow={program.sponsor_name ?? "Program"} title={program.name} description={program.description ?? undefined} />
      {isAdmin && report && (
        <Card className="mb-6"><CardHeader><CardTitle>Program report</CardTitle><CardDescription>What a sponsor sees: totals only, never individual businesses.</CardDescription></CardHeader>
          <ProgramReport programId={pid} report={report as unknown as Report} />
        </Card>
      )}
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <Card className="p-0">
          <CardHeader className="p-5 pb-0">
            <CardTitle>Enrolled businesses ({rows.length})</CardTitle>
            <CardDescription>
              Pulse now, and at joining. This is observed change, not proof that the program caused it.
            </CardDescription>
          </CardHeader>
          <PortfolioTable rows={rows} extra={isAdmin && partners.length ? (r) => {
            const assigned = (assignments ?? []).filter((a) => a.business_id === r.business_id).map((a) => a.partner_user_id);
            return (
              <form action={assignPartner} className="flex items-center gap-2">
                <input type="hidden" name="programId" value={pid} /><input type="hidden" name="businessId" value={r.business_id} />
                <Select name="partnerId" aria-label={`Partner for ${r.name}`} className="h-9 w-40 text-xs" defaultValue={assigned[0] ?? ""}>
                  <option value="" disabled>Assign partner</option>
                  {partners.map((p) => <option key={p.user_id} value={p.user_id}>{name(p)}</option>)}
                </Select>
                <Button size="sm" variant="outline">Assign</Button>
              </form>
            );
          } : undefined} />
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Join code</CardTitle><CardDescription>Business owners enter this in their Settings to join and consent to sharing.</CardDescription></CardHeader>
            <p className="rounded-xl bg-muted py-3 text-center font-mono text-2xl tracking-[0.3em]" data-testid="join-code">{program.join_code}</p>
            <p className="mt-2 break-all text-xs text-muted-foreground">Invite link: <span data-testid="join-link">{new URL(`/join/${program.join_code}`, publicEnv.NEXT_PUBLIC_SITE_URL).toString()}</span></p>
          </Card>
          <Card><CardHeader><CardTitle>Invite businesses</CardTitle><CardDescription>Invites from a business partner are credited to them.</CardDescription></CardHeader><InviteForm programId={pid} /></Card>
          {isAdmin && (
            <Card>
              <CardHeader><CardTitle>Seats and billing</CardTitle>
                <CardDescription>
                  {paid ? `${program.seats} seats${program.current_period_end ? `, renews ${formatDate(program.current_period_end)}` : ""}.` : `Pilot: up to ${program.pilot_seats} businesses free.`}
                </CardDescription>
              </CardHeader>
              {billing === "success" && <p role="status" className="mb-3 text-sm text-growth">Payment received. Seats update in a moment.</p>}
              {billing === "unavailable" && <p role="alert" className="mb-3 text-sm text-orange-ink">Billing isn&apos;t set up on this deployment yet.</p>}
              <div className="flex items-center gap-3">
                <Badge tone={paid ? "brand" : "neutral"}>{program.subscription_status ?? "pilot"}</Badge>
                {!paid && billingConfigured() && (
                  <form action={startCheckout}><input type="hidden" name="programId" value={pid} /><Button size="sm"><CreditCard /> Add {program.seats} seats</Button></form>
                )}
              </div>
            </Card>
          )}
          {isAdmin && (
            <Card><CardHeader><CardTitle>Program settings</CardTitle></CardHeader><ProgramSettingsForm program={program} /></Card>
          )}
          {isAdmin && (
            <Card>
              <CardHeader><CardTitle>Team</CardTitle><CardDescription>Business partners only see businesses assigned to them.</CardDescription></CardHeader>
              <ul className="mb-4 space-y-1 text-sm">{members?.map((m) => <li key={m.user_id} className="flex justify-between"><span>{name(m)}</span><span className="text-muted-foreground">{m.role}</span></li>)}</ul>
              <AddMemberForm programId={pid} />
            </Card>
          )}
        </div>
      </div>
    </SimpleShell>
  );
}
