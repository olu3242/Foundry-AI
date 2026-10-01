import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Certification" };

type Link = { link: string; status: "evidenced" | "insufficient_evidence" | "not_met"; evidence: Record<string, unknown> };
type Cert = { loop: Link[]; loop_status: string; note: string; period_days: number } & Record<string, Record<string, unknown>>;
const TONE = { evidenced: "brand", insufficient_evidence: "opportunity", not_met: "attention" } as const;

function Flat({ data }: { data: Record<string, unknown> }) {
  const rows = Object.entries(data).flatMap(([k, v]) => (v !== null && typeof v === "object" && !Array.isArray(v)
    ? Object.entries(v as Record<string, unknown>).filter(([, x]) => x === null || typeof x !== "object").map(([k2, x]) => [`${k} · ${k2}`, x] as const)
    : v === null || typeof v !== "object" ? [[k, v] as const] : []));
  return <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 text-xs">{rows.map(([k, v]) => <div key={k} className="contents"><dt className="text-muted-foreground">{k.replaceAll("_", " ")}</dt><dd className="text-right tabular-nums">{v == null ? "—" : String(v)}</dd></div>)}</dl>;
}

export default async function CertificationPage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("moat_certification", { p_days: 90 });
  const c = data as unknown as Cert;
  return (
    <>
      <PageHeader eyebrow="Admin" title="Moat & scale certification" description={`Live evidence over the last ${c.period_days} days. ${c.note}`} />
      <Card className="mb-6" aria-label="Closed loop">
        <CardHeader><CardTitle className="flex items-center gap-2">Closed loop <Badge tone={c.loop_status === "PASS" ? "brand" : c.loop_status === "FAIL" ? "attention" : "opportunity"} data-testid="loop-status">{c.loop_status}</Badge></CardTitle>
          <CardDescription>Passes only when every link is evidenced by live data.</CardDescription></CardHeader>
        <ol className="space-y-2 text-sm">{c.loop.map((l, i) => (
          <li key={l.link} className="flex flex-wrap items-start gap-2" aria-label={`Link ${l.link}`}>
            <span className="w-6 text-muted-foreground">{i + 1}.</span><span className="w-56 font-medium">{l.link}</span>
            <Badge tone={TONE[l.status]}>{l.status.replaceAll("_", " ")}</Badge>
            <code className="flex-1 text-xs text-muted-foreground">{JSON.stringify(l.evidence)}</code>
          </li>))}</ol>
      </Card>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(["data", "intelligence", "solutions", "network", "operations", "economics", "impact"] as const).map((k) => (
          <Card key={k} aria-label={`Moat ${k}`}><CardHeader><CardTitle className="capitalize">{k}</CardTitle></CardHeader><Flat data={c[k] ?? {}} /></Card>
        ))}
      </div>
    </>
  );
}
