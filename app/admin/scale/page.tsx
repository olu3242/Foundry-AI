import type { Metadata } from "next";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CostForm } from "@/components/admin/cost-form";
import { buildEvidencePack } from "@/lib/evidence";

export const metadata: Metadata = { title: "Scale" };

type Section = Record<string, unknown>;
const SECTIONS: [string, string][] = [
  ["product", "Product"], ["operations", "Operations"], ["solutions", "Solutions"], ["economics_usd", "Economics (USD)"],
  ["impact_usd", "Impact (USD, verified)"], ["distribution", "Distribution"], ["data_moat", "Data moat"],
];
const show = (v: unknown) => (v === null || v === undefined ? "—" : typeof v === "object" ? Object.entries(v as Section).map(([k, x]) => `${k.replace(/_/g, " ")} ${x}`).join(" · ") : String(v));

/** B20: one canonical evidence layer. Every figure is computed from B1–B19 data, never entered by hand (costs aside). */
export default async function ScalePage() {
  const supabase = await createClient();
  const pack = await buildEvidencePack(supabase);
  const m = (pack.metrics_30d ?? {}) as Record<string, Section>;
  const cohorts = (pack.cohort_retention ?? []) as { cohort: string; size: number; month_offset: number; rate: number }[];
  const cohortNames = [...new Set(cohorts.map((c) => c.cohort))];
  return (
    <>
      <PageHeader eyebrow="Admin" title="Scale and funding readiness"
        description="Last 30 days. Impact counts only improvements a partner verified; it shows association, not proof of cause."
        actions={<a href="/api/admin/evidence" className="text-sm font-medium text-growth hover:underline">Download evidence pack (JSON)</a>} />
      <div className="mb-6 flex flex-wrap gap-3" aria-label="Certification">
        {[["Security", pack.certification.security_ok], ["Data integrity", pack.certification.integrity_ok]].map(([k, ok]) => (
          <span key={String(k)} className={`glass flex items-center gap-2 px-3 py-1.5 text-sm ${ok ? "text-growth" : "text-orange-ink"}`}>
            {ok ? <ShieldCheck className="size-4" aria-hidden /> : <ShieldAlert className="size-4" aria-hidden />} {String(k)}: {ok ? "passing" : "needs attention"}
          </span>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {SECTIONS.map(([key, title]) => (
          <Card key={key} aria-label={title}>
            <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {Object.entries(m[key] ?? {}).filter(([k]) => k !== "note").map(([k, v]) => (
                <div key={k} className="contents"><dt className="text-muted-foreground">{k.replace(/_/g, " ")}</dt><dd className="text-right tabular-nums" data-testid={`${key}.${k}`}>{show(v)}</dd></div>
              ))}
            </dl>
            {typeof m[key]?.note === "string" && <CardDescription className="mt-3">{String(m[key]!.note)}</CardDescription>}
          </Card>
        ))}
        <Card aria-label="Cohort retention">
          <CardHeader><CardTitle>Cohort retention</CardTitle><CardDescription>Share of each signup month still recording in later months.</CardDescription></CardHeader>
          <table className="w-full text-xs">
            <tbody>{cohortNames.map((c) => (
              <tr key={c}><td className="p-1 font-medium">{c} ({cohorts.find((x) => x.cohort === c)?.size})</td>
                {cohorts.filter((x) => x.cohort === c).map((x) => <td key={x.month_offset} className="p-1 tabular-nums">M{x.month_offset} {Math.round(x.rate * 100)}%</td>)}</tr>
            ))}</tbody>
          </table>
        </Card>
        <Card><CardHeader><CardTitle>Costs</CardTitle><CardDescription>Infrastructure and operator costs for unit economics (AI cost is computed from usage).</CardDescription></CardHeader><CostForm /></Card>
      </div>
    </>
  );
}
