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
import { assignPartner, decidePackage, startCheckout } from "../actions";
import { ProductForm } from "@/components/finance/lender";
import { PassportView } from "@/components/passport/passport-view";
import type { PassportFacts, PassportPulse, PassportSection } from "@/lib/passport/facts";
import { formatMoney } from "@/lib/money";

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
  const { data: packages } = isAdmin && program.kind === "lender"
    ? await supabase.from("evidence_packages").select("id, status, sections, snapshot, snapshot_sha256, eligibility, requested_amount_minor, purpose, submitted_at, financial_products(name, currency)")
        .eq("program_id", pid).order("submitted_at", { ascending: false })
    : { data: null };
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
      {isAdmin && program.kind === "lender" && (
        <div className="mb-6 grid gap-6 xl:grid-cols-[1fr_380px]">
          <Card>
            <CardHeader><CardTitle>Evidence packages ({packages?.length ?? 0})</CardTitle>
              <CardDescription>Frozen snapshots each business chose to share. You don&apos;t get access to their books; withdrawn or expired packages disappear.</CardDescription></CardHeader>
            <div className="space-y-6">
              {packages?.map((p) => {
                const snap = p.snapshot as Record<string, unknown>;
                const facts = { provenance_180: {}, monthly_sales: [], verifications: [], verified_outcomes: [], months_with_records: 0, active_days_90: 0, records_180: 0, highest_level: null, ...snap } as unknown as PassportFacts;
                return (
                  <article key={p.id} aria-label={`Package from ${String(snap.name)}`} className="space-y-3 rounded-xl border p-4">
                    <p className="text-sm"><span className="font-semibold">{String(snap.name)}</span> asks {formatMoney(p.requested_amount_minor ?? 0, p.financial_products?.currency ?? "NGN")} for “{p.purpose}” · {p.status.replace("_", " ")}</p>
                    <PassportView facts={facts} pulse={(snap.pulse as PassportPulse) ?? null} sections={p.sections as PassportSection[]} />
                    <p className="break-all text-xs text-muted-foreground">Snapshot SHA-256 {p.snapshot_sha256}</p>
                    {["submitted", "under_review"].includes(p.status) && (
                      <form action={decidePackage} className="flex flex-wrap gap-2">
                        <input type="hidden" name="programId" value={pid} /><input type="hidden" name="id" value={p.id} />
                        <input name="note" aria-label="Decision note" placeholder="Note to the business" className="h-9 flex-1 rounded-xl border bg-surface/60 px-3 text-xs" />
                        <Select name="status" aria-label="Decision" className="h-9 w-36 text-xs" defaultValue="approved">
                          <option value="approved">Approve</option><option value="declined">Decline</option><option value="under_review">Mark reviewing</option>
                        </Select>
                        <Button size="sm">Send decision</Button>
                      </form>
                    )}
                  </article>
                );
              })}
            </div>
          </Card>
          <Card><CardHeader><CardTitle>List a finance product</CardTitle><CardDescription>Set clear requirements; businesses see exactly which they meet.</CardDescription></CardHeader><ProductForm programId={pid} /></Card>
        </div>
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
