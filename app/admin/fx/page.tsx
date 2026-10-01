import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/money";
import { PlanPriceForm } from "./price-form";

export const metadata: Metadata = { title: "FX and prices" };

type S = { max_age_hours: number; usd_reportable: boolean; revenue_rows_on_placeholder_fx: number; history_rows: number;
  rates: { currency: string; usd_per_unit: number; source: string; effective_date: string; age_hours: number | null; placeholder: boolean; stale: boolean; in_use: boolean }[] };

export default async function FxPage() {
  const supabase = await createClient();
  const [{ data }, { data: plans }, { data: prices }] = await Promise.all([
    supabase.rpc("fx_status"),
    supabase.from("billing_plans").select("id, key, name, price_minor, currency").eq("status", "active").order("price_minor"),
    supabase.from("billing_plan_prices").select("plan_id, currency, price_minor"),
  ]);
  const s = data as unknown as S;
  return (
    <>
      <PageHeader eyebrow="Admin" title="FX and market prices"
        description="Native amounts are the truth. USD is a dated snapshot taken when revenue happens, from a sourced rate. Placeholder or stale rates make USD totals not reportable." />
      <Card className="mb-6" aria-label="FX status">
        <CardHeader><CardTitle className="flex items-center gap-2">Rates <Badge tone={s.usd_reportable ? "brand" : "attention"} data-testid="usd-reportable">
          {s.usd_reportable ? "USD reportable" : "USD not reportable"}</Badge></CardTitle>
          <CardDescription>Fresh means fetched in the last {s.max_age_hours}h · {s.history_rows} sourced rate(s) on file · {s.revenue_rows_on_placeholder_fx} revenue row(s) converted with a placeholder rate</CardDescription></CardHeader>
        <table className="w-full text-sm"><thead><tr className="text-left text-xs text-muted-foreground"><th>Currency</th><th>USD per unit</th><th>Source</th><th>Effective</th><th>State</th></tr></thead>
          <tbody>{s.rates.map((r) => (
            <tr key={r.currency} aria-label={`Rate ${r.currency}`}><td>{r.currency}{r.in_use ? "" : " (unused)"}</td><td className="font-mono">{r.usd_per_unit}</td><td>{r.source}</td><td>{r.effective_date}</td>
              <td data-testid="rate-state">{r.placeholder ? "placeholder" : r.stale ? `stale (${r.age_hours}h)` : "fresh"}</td></tr>))}</tbody></table>
      </Card>
      <Card aria-label="Market prices">
        <CardHeader><CardTitle>Market prices</CardTitle>
          <CardDescription>A business is charged in its own currency when its plan has a price there; otherwise at the base price. There is no FX conversion at billing. Changes need a second admin.</CardDescription></CardHeader>
        <ul className="mb-4 space-y-1 text-sm">{(plans ?? []).filter((p) => p.price_minor > 0).map((p) => (
          <li key={p.key}><b>{p.name}</b>: {formatMoney(p.price_minor, p.currency)} base
            {(prices ?? []).filter((x) => x.plan_id === p.id).map((x) => <span key={x.currency} data-testid={`price-${p.key}-${x.currency}`}> · {formatMoney(x.price_minor, x.currency)}</span>)}</li>))}</ul>
        <PlanPriceForm plans={(plans ?? []).filter((p) => p.price_minor > 0)} />
      </Card>
    </>
  );
}
