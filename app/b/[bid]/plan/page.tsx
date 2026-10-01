import type { Metadata } from "next";
import { requireBusiness } from "@/lib/auth/guards";
import { PageHeader } from "@/components/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChoosePlanForm } from "@/components/billing/choose-plan-form";
import { PayChargeForm } from "@/components/billing/pay-charge-form";
import { paystackConfigured } from "@/lib/payments/paystack";
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

const PAYMENT_NOTICE: Record<string, string> = {
  paid: "Payment received. Thank you.",
  pending: "We're waiting for the payment to be confirmed. This page updates when it is.",
  failed: "The payment didn't go through. You can try again.",
  abandoned: "The payment wasn't completed. You can try again.",
  mismatch: "We received a different amount than expected. Our team will contact you.",
  duplicate: "This charge was already paid. Our team will refund the extra payment.",
};

export default async function PlanPage({ params, searchParams }: { params: Promise<{ bid: string }>; searchParams: Promise<{ payment?: string }> }) {
  const { bid } = await params;
  const { payment } = await searchParams;
  const online = paystackConfigured();
  const { role, supabase } = await requireBusiness(bid);
  const [{ data }, { data: charges }] = await Promise.all([
    supabase.rpc("entitlement_status", { p_business_id: bid }),
    supabase.from("billable_events").select("id, description, amount_minor, currency, status, created_at").eq("business_id", bid).eq("payer_kind", "business")
      .order("created_at", { ascending: false }).limit(12),
  ]);
  const { data: payments } = await supabase.from("payment_requests").select("billable_event_id, status, payment_channel, created_at").eq("business_id", bid)
    .order("created_at", { ascending: false }).limit(30);
  const lastPayment = (id: string) => payments?.find((p) => p.billable_event_id === id);
  const s = data as unknown as Status;

  return (
    <>
      <PageHeader eyebrow="Plan & usage" title={s.plan.name}
        description="What your plan includes this month and how much you've used. Limits reset on the 1st." />
      {payment && PAYMENT_NOTICE[payment] && (
        <p role="status" className="mb-4 rounded-lg border bg-muted/40 px-4 py-3 text-sm" data-testid="payment-notice">{PAYMENT_NOTICE[payment]}</p>
      )}
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
              <li key={c.id} className="flex flex-wrap items-center gap-3 py-2" aria-label={`Charge ${c.description}`}>
                <span className="flex-1">{c.description}
                  {lastPayment(c.id) && <span className="block text-xs text-muted-foreground">Last payment: {lastPayment(c.id)!.status.replaceAll("_", " ")}
                    {lastPayment(c.id)!.payment_channel ? ` · ${lastPayment(c.id)!.payment_channel!.replaceAll("_", " ")}` : ""}</span>}</span>
                <span>{formatMoney(c.amount_minor, c.currency)}</span>
                <Badge tone={c.status === "paid" ? "brand" : "neutral"} data-testid="charge-status">{c.status}</Badge>
                {c.status === "open" && online && (role === "owner" || role === "staff") && <PayChargeForm businessId={bid} chargeId={c.id} />}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
