import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { rateBilling, settleCharge } from "../actions";

export const metadata: Metadata = { title: "Commercial" };

type Overview = {
  plans: { key: string; name: string; payer_kind: string; price_minor: number; currency: string; active: number }[];
  open: { id: string; kind: string; description: string; amount_minor: number; currency: string; payer_kind: string; business: string; created_at: string }[];
  revenue_30d: { payer_kind: string; kind: string; n: number; usd: number }[];
  recent_revenue: { id: string; amount_minor: number; currency: string; source: string; at: string }[];
};
type Trace = Record<string, Record<string, unknown> | null>;

export default async function CommercialPage({ searchParams }: { searchParams: Promise<{ trace?: string }> }) {
  const { trace } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.rpc("commercial_overview");
  const o = data as unknown as Overview;
  const traced = trace ? ((await supabase.rpc("commercial_trace", { p_revenue_event_id: trace })).data as unknown as Trace) : null;

  return (
    <>
      <PageHeader eyebrow="Admin" title="Commercial" description="Plans → entitlements → usage → charges → revenue. Every revenue row traces back to who paid, for what, and what was used." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card aria-label="Plans">
          <CardHeader><CardTitle>Plans</CardTitle></CardHeader>
          <ul className="divide-y text-sm">{o.plans.map((p) => (
            <li key={p.key} className="flex justify-between py-2"><span>{p.name} <span className="text-xs text-muted-foreground">({p.payer_kind})</span></span>
              <span>{formatMoney(p.price_minor, p.currency)} · {p.active} active</span></li>))}</ul>
        </Card>
        <Card aria-label="Revenue (30 days)">
          <CardHeader><CardTitle>Revenue, last 30 days</CardTitle><CardDescription>USD at indicative rates.</CardDescription></CardHeader>
          <ul className="divide-y text-sm">{o.revenue_30d.map((r) => (
            <li key={`${r.payer_kind}${r.kind}`} className="flex justify-between py-2"><span>{r.payer_kind} · {r.kind}</span><span>{r.n} · ${r.usd}</span></li>))}
            {!o.revenue_30d.length && <li className="py-2 text-muted-foreground">No revenue yet.</li>}</ul>
          <ul className="mt-3 space-y-1 text-xs">{o.recent_revenue.map((r) => (
            <li key={r.id}><a className="hover:underline" href={`/admin/commercial?trace=${r.id}`}>Trace {formatMoney(r.amount_minor, r.currency)} · {r.source} · {formatDate(r.at)}</a></li>))}</ul>
        </Card>
      </div>
      {traced && (
        <Card className="mt-6" aria-label="Revenue trace">
          <CardHeader><CardTitle>Revenue trace</CardTitle></CardHeader>
          <ol className="space-y-2 text-sm">
            {(["customer", "product", "entitlement", "usage", "billable", "revenue"] as const).map((k) => (
              <li key={k}><span className="font-medium capitalize">{k}</span>: <code className="text-xs">{JSON.stringify(traced[k])}</code></li>))}
          </ol>
        </Card>
      )}
      <Card className="mt-6" aria-label="Open charges">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Open charges</CardTitle>
          <form action={rateBilling}><Button size="sm">Rate this month</Button></form>
        </CardHeader>
        <ul className="divide-y text-sm">
          {o.open.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center gap-2 py-3" aria-label={`Charge ${b.business} ${b.description}`}>
              <span className="flex-1">{b.business} · {b.description} <Badge tone="neutral">{b.payer_kind}</Badge></span>
              <span>{formatMoney(b.amount_minor, b.currency)}</span>
              <form action={settleCharge} className="flex gap-1">
                <input type="hidden" name="id" value={b.id} />
                <Select name="method" aria-label="Payment method" className="h-8 w-32 text-xs"><option value="mobile_money">Mobile money</option><option value="bank_transfer">Bank transfer</option><option value="card">Card</option><option value="cash">Cash</option></Select>
                <Input name="reference" aria-label="Payment reference" placeholder="Reference" required minLength={3} className="h-8 w-32 text-xs" />
                <Button size="sm">Record payment</Button>
              </form>
            </li>
          ))}
          {!o.open.length && <li className="py-2 text-muted-foreground">Nothing open.</li>}
        </ul>
      </Card>
    </>
  );
}
