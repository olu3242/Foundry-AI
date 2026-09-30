import type { Metadata } from "next";
import { requireBusiness } from "@/lib/auth/guards";
import { PageHeader } from "@/components/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChoosePlanForm } from "@/components/billing/choose-plan-form";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Plan & usage" };

const FEATURE_LABEL: Record<string, string> = {
  "capture.ai": "Automatic readings (voice, text, photo)",
  "plan.start": "Plans started",
  "evidence.package": "Evidence packages shared",
};
const SOURCE_LABEL: Record<string, string> = { default: "Free", purchase: "Paid by you", sponsorship: "Sponsored", partner: "Paid by a partner" };

type Status = {
  source: string; since: string; paid_by: string | null; open_charges: number;
  plan: { key: string; name: string; price_minor: number; currency: string };
  features: { feature: string; included: number; used: number; overage_minor: number | null }[];
  available_plans: { key: string; name: string; price_minor: number; currency: string; entitlements: Record<string, number> }[];
};

export default async function PlanPage({ params }: { params: Promise<{ bid: string }> }) {
  const { bid } = await params;
  const { role, supabase } = await requireBusiness(bid);
  const [{ data }, { data: charges }] = await Promise.all([
    supabase.rpc("entitlement_status", { p_business_id: bid }),
    supabase.from("billable_events").select("id, description, amount_minor, currency, status, created_at").eq("business_id", bid).eq("payer_kind", "business")
      .order("created_at", { ascending: false }).limit(12),
  ]);
  const s = data as unknown as Status;

  return (
    <>
      <PageHeader eyebrow="Plan & usage" title={s.plan.name}
        description="What your plan includes this month and how much you've used. Limits reset on the 1st." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card aria-label="Current plan">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">{s.plan.name} <Badge tone={s.source === "default" ? "neutral" : "brand"}>{SOURCE_LABEL[s.source] ?? s.source}</Badge></CardTitle>
            <CardDescription>
              {s.paid_by ? `Paid for by ${s.paid_by}. ` : ""}
              {s.plan.price_minor > 0 ? `${formatMoney(s.plan.price_minor, s.plan.currency)} a month` : "No charge"} · since {formatDate(s.since)}
            </CardDescription>
          </CardHeader>
          <ul className="space-y-3 text-sm">
            {s.features.map((f) => {
              const pct = f.included === -1 ? 0 : Math.min(100, Math.round((f.used / Math.max(1, f.included)) * 100));
              return (
                <li key={f.feature} aria-label={FEATURE_LABEL[f.feature] ?? f.feature}>
                  <div className="flex justify-between"><span>{FEATURE_LABEL[f.feature] ?? f.feature}</span>
                    <span data-testid={`usage-${f.feature}`}>{f.used} / {f.included === -1 ? "unlimited" : f.included}</span></div>
                  <div className="mt-1 h-1.5 rounded-full bg-muted"><div className="h-1.5 rounded-full bg-primary" style={{ width: `${pct}%` }} /></div>
                  {f.overage_minor != null && <p className="mt-1 text-xs text-muted-foreground">Beyond the limit: {formatMoney(Number(f.overage_minor), s.plan.currency)} each</p>}
                </li>
              );
            })}
          </ul>
        </Card>
        {role === "owner" && s.source !== "sponsorship" && s.source !== "partner" && (
          <Card>
            <CardHeader><CardTitle>Change plan</CardTitle><CardDescription>Paid plans are billed monthly. Pay by mobile money, bank transfer or card.</CardDescription></CardHeader>
            <ChoosePlanForm businessId={bid} current={s.plan.key} plans={s.available_plans} />
          </Card>
        )}
      </div>
      {!!charges?.length && (
        <Card className="mt-6" aria-label="Charges">
          <CardHeader><CardTitle>Charges</CardTitle></CardHeader>
          <ul className="divide-y text-sm">
            {charges.map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-2">
                <span className="flex-1">{c.description}</span><span>{formatMoney(c.amount_minor, c.currency)}</span>
                <Badge tone={c.status === "paid" ? "brand" : "neutral"}>{c.status}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
