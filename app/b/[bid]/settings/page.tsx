import type { Metadata } from "next";
import { requireBusiness, WRITER_ROLES } from "@/lib/auth/guards";
import { PageHeader } from "@/components/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AddMemberForm, BusinessForm, IdentifierForm, JoinProgramForm } from "./forms";
import { leaveProgram } from "./actions";
import { AutonomySettings } from "@/components/agent/autonomy-settings";

export const metadata: Metadata = { title: "Settings" };

const ROLE_LABEL = { owner: "Owner", staff: "Staff", partner: "Business partner", program_admin: "Program admin" } as const;

export default async function SettingsPage({ params }: { params: Promise<{ bid: string }> }) {
  const { bid } = await params;
  const { business, role, supabase } = await requireBusiness(bid);
  const { data: team } = await supabase
    .from("memberships")
    .select("user_id, role, profiles:user_id (full_name, phone, email)")
    .eq("business_id", bid)
    .order("created_at");
  const isOwner = role === "owner";
  const [{ data: market }, { data: identifiers }] = await Promise.all([
    supabase.from("markets").select("name, identifier_types, jurisdiction").eq("country_code", business.country_code).maybeSingle(),
    supabase.from("business_identifiers").select("type, value, verified").eq("business_id", bid),
  ]);
  const [{ data: policies }, { data: enrollments }] = await Promise.all([
    supabase.from("autonomy_policies").select("action_type, level").eq("business_id", bid),
    WRITER_ROLES.includes(role) ? supabase.rpc("program_access_for_business", { p_business_id: bid }) : Promise.resolve({ data: [] }),
  ]);

  return (
    <>
      <PageHeader eyebrow="Settings" title="Business and team" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Business</CardTitle>
            <CardDescription>{business.country_code} · amounts in {business.currency}</CardDescription>
          </CardHeader>
          <BusinessForm businessId={bid} name={business.name} sector={business.sector} canEdit={isOwner} />
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Team</CardTitle>
            <CardDescription>People who can see or record for this business.</CardDescription>
          </CardHeader>
          <ul className="mb-6 divide-y">
            {(team ?? []).map((m) => {
              const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
              return (
                <li key={m.user_id} className="flex items-center justify-between py-3 text-sm">
                  <span className="truncate">{p?.full_name || p?.email || (p?.phone ? `+${p.phone}` : "Member")}</span>
                  <Badge tone={m.role === "owner" ? "brand" : "neutral"}>{ROLE_LABEL[m.role]}</Badge>
                </li>
              );
            })}
          </ul>
          {isOwner && <AddMemberForm businessId={bid} />}
        </Card>
        <Card>
          <CardHeader>
            <CardTitle><a href={`/b/${bid}/plan`} className="hover:underline">Plan &amp; usage →</a></CardTitle>
            <CardDescription>What your plan includes, what you&apos;ve used this month, and who pays.</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Registration numbers</CardTitle>
            <CardDescription>Used in {market?.name ?? business.country_code}. They help partners recognise your business.</CardDescription>
          </CardHeader>
          <ul className="mb-3 space-y-1 text-sm">
            {(identifiers ?? []).map((i) => <li key={i.type}>{(market?.identifier_types as { key: string; label: string }[] | undefined)?.find((t) => t.key === i.type)?.label ?? i.type}: <span className="font-mono">{i.value}</span></li>)}
          </ul>
          {isOwner && (
            <IdentifierForm businessId={bid} types={(market?.identifier_types ?? []) as { key: string; label: string }[]}
              current={Object.fromEntries((identifiers ?? []).map((i) => [i.type, i.value]))} />
          )}
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Programs</CardTitle>
            <CardDescription>Cohorts, accelerators and lender programs you share your records with.</CardDescription>
          </CardHeader>
          {!!enrollments?.length && (
            <ul className="mb-4 divide-y text-sm">
              {enrollments.map((e) => (
                <li key={e.program_id} className="flex items-center gap-3 py-2">
                  <span className="flex-1">{e.program_name}
                    <span className="block text-xs text-muted-foreground">
                      Sharing since {new Date(e.consented_at).toLocaleDateString("en", { dateStyle: "medium" })} · seen by {e.admins} program admin(s)
                      {e.assigned_partners.length ? ` and ${e.assigned_partners.join(", ")}` : ""}
                    </span>
                  </span>
                  {isOwner && (
                    <form action={leaveProgram}>
                      <input type="hidden" name="businessId" value={bid} /><input type="hidden" name="programId" value={e.program_id} />
                      <button className="text-xs font-medium text-destructive hover:underline">Leave and stop sharing</button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
          {isOwner ? <JoinProgramForm businessId={bid} /> : <p className="text-sm text-muted-foreground">Only the owner can join programs.</p>}
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>How much Foundry does on its own</CardTitle>
            <CardDescription>
              From L0 (off) to L5 (acts within limits). Some levels aren&apos;t available yet: Foundry never writes to your books or messages a customer without you.
            </CardDescription>
          </CardHeader>
          <AutonomySettings businessId={bid} canEdit={isOwner} policies={Object.fromEntries((policies ?? []).map((p) => [p.action_type, p.level]))} />
        </Card>
      </div>
    </>
  );
}
