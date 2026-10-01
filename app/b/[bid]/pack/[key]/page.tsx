import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireBusiness, WRITER_ROLES } from "@/lib/auth/guards";
import { PageHeader } from "@/components/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EntityForm, type FieldSpec } from "@/components/packs/entity-form";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Business pack" };

type Def = { description?: string; entities: Record<string, { label: string; fields: Record<string, FieldSpec> }> };
type Signal = { pack: string; metric: string; label: string; value: number | null; state: string; explain: string; action: string; format?: string };
type Bench = { sample: number; median: number | null; confidence: string; note: string | null; cohort: string };

const TONE: Record<string, "brand" | "attention" | "opportunity" | "neutral"> = { healthy: "brand", at_risk: "attention", watch: "opportunity", unknown: "neutral" };

export default async function PackPage({ params }: { params: Promise<{ bid: string; key: string }> }) {
  const { bid, key } = await params;
  const { role, supabase } = await requireBusiness(bid);
  const [{ data: pack }, { data: on }, { data: signals }, { data: recent }] = await Promise.all([
    supabase.from("vertical_packs").select("key, name, definition").eq("key", key).maybeSingle(),
    supabase.from("business_packs").select("pack_key").eq("business_id", bid).eq("pack_key", key).maybeSingle(),
    supabase.rpc("pack_pulse", { p_business_id: bid }),
    supabase.from("vertical_records").select("id, entity, data, occurred_at").eq("business_id", bid).eq("pack_key", key).is("voided_at", null).order("occurred_at", { ascending: false }).limit(15),
  ]);
  if (!pack || !on) notFound();
  const def = pack.definition as unknown as Def;
  const mine = ((signals ?? []) as unknown as Signal[]).filter((s) => s.pack === key);
  const benches = await Promise.all(mine.map(async (s) => (await supabase.rpc("pack_benchmark", { p_business_id: bid, p_metric: s.metric })).data as unknown as Bench));
  const fmt = (s: Signal) => (s.value == null ? "unknown" : s.format === "percent" ? `${Math.round(s.value * 1000) / 10}%` : String(s.value));

  return (
    <>
      <PageHeader eyebrow="Business pack" title={pack.name} description={def.description} />
      <div className="grid gap-4 lg:grid-cols-2" aria-label="Pack signals">
        {mine.map((s, i) => (
          <Card key={s.metric} aria-label={s.label}>
            <CardHeader><CardTitle className="flex items-center gap-2">{s.label} <Badge tone={TONE[s.state] ?? "neutral"}>{s.state.replace("_", " ")}</Badge></CardTitle>
              <CardDescription>{s.explain}</CardDescription></CardHeader>
            <p className="text-2xl font-semibold" data-testid={`pack-value-${s.metric.split(":")[2]}`}>{fmt(s)}</p>
            {s.state !== "unknown" && <p className="mt-1 text-sm">{s.action}</p>}
            <p className="mt-2 text-xs text-muted-foreground">{benches[i]?.note ?? `${benches[i]?.cohort}: median ${benches[i]?.median} (n=${benches[i]?.sample}, ${benches[i]?.confidence} confidence)`}</p>
          </Card>
        ))}
      </div>
      {WRITER_ROLES.includes(role) && Object.entries(def.entities).map(([entity, e]) => (
        <Card key={entity} className="mt-6"><CardHeader><CardTitle>{e.label}</CardTitle></CardHeader>
          <EntityForm businessId={bid} pack={key} entity={entity} label={e.label} fields={e.fields} /></Card>
      ))}
      {!!recent?.length && (
        <Card className="mt-6" aria-label="Pack records"><CardHeader><CardTitle>Recent entries</CardTitle></CardHeader>
          <ul className="divide-y text-sm">{recent.map((r) => (
            <li key={r.id} className="py-2">{formatDate(r.occurred_at)} · {def.entities[r.entity]?.label ?? r.entity}: {Object.entries(r.data as Record<string, unknown>).map(([k, v]) => `${k} ${String(v)}`).join(", ")}</li>))}</ul>
        </Card>
      )}
    </>
  );
}
