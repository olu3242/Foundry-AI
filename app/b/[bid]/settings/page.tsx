import type { Metadata } from "next";
import { requireBusiness } from "@/lib/auth/guards";
import { PageHeader } from "@/components/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AddMemberForm, BusinessForm } from "./forms";

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
      </div>
    </>
  );
}
