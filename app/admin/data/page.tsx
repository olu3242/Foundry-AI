import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { buildDataset } from "../actions";

export const metadata: Metadata = { title: "Data layer" };

type Lineage = { source: { table: string; columns: string[] }[]; transformation: { dataset: string; version: number; description: string; latest_build: Record<string, unknown> | null };
  feature: { key: string; description: string }; use: { use: string; consumer: string }[]; permitted_uses: string[]; consent: { rule: string; min_group_size: number } };

export default async function DataLayerPage() {
  const supabase = await createClient();
  const [{ data: datasets }, { data: log }] = await Promise.all([
    supabase.from("datasets").select("key, version, purpose, allowed_uses, min_group_size, features"),
    supabase.from("dataset_access_log").select("dataset_key, purpose, allowed, at").order("at", { ascending: false }).limit(15),
  ]);
  const lineages = await Promise.all((datasets ?? []).flatMap((d) => (d.features as { key: string }[]).map(async (f) =>
    ({ key: `${d.key}.${f.key}`, l: (await supabase.rpc("feature_lineage", { p_feature_key: `${d.key}.${f.key}` })).data as unknown as Lineage }))));
  return (
    <>
      <PageHeader eyebrow="Admin" title="Data layer" description="Governed, consented, derived datasets. Every feature traces SOURCE → TRANSFORMATION → FEATURE → USE; opted-out businesses and small groups never appear." />
      <div className="space-y-4">
        {datasets?.map((d) => (
          <Card key={d.key} aria-label={`Dataset ${d.key}`}>
            <CardHeader className="flex-row items-start justify-between gap-2">
              <div><CardTitle>{d.key} · v{d.version}</CardTitle><CardDescription>{d.purpose} · permitted for: {d.allowed_uses.join(", ")} · min group {d.min_group_size}</CardDescription></div>
              <form action={buildDataset}><input type="hidden" name="key" value={d.key} /><Button size="sm" variant="outline">Build now</Button></form>
            </CardHeader>
            {lineages.filter((x) => x.key.startsWith(`${d.key}.`)).map(({ key, l }) => (
              <div key={key} className="mt-3 rounded-lg border p-3 text-xs" aria-label={`Lineage ${key}`}>
                <p className="font-medium">{key}: {l.feature.description}</p>
                <p><b>Source:</b> {l.source.map((s) => `${s.table}(${s.columns.join(", ")})`).join(" · ")}</p>
                <p><b>Transformation:</b> {l.transformation.description}</p>
                <p><b>Latest build:</b> {l.transformation.latest_build ? `${formatDate(String(l.transformation.latest_build.at))} · ${l.transformation.latest_build.businesses} businesses · ${l.transformation.latest_build.excluded_opt_out} opted out · ${l.transformation.latest_build.suppressed_groups} groups suppressed` : "not built yet"}</p>
                <p><b>Use:</b> {l.use.map((u) => `${u.use} → ${u.consumer}`).join(" · ") || "—"}</p>
              </div>
            ))}
          </Card>
        ))}
      </div>
      <Card className="mt-6" aria-label="Access log"><CardHeader><CardTitle>Access log</CardTitle></CardHeader>
        <ul className="text-xs">{log?.map((r, i) => <li key={i}>{formatDate(r.at)} · {r.dataset_key} for {r.purpose} → {r.allowed ? "allowed" : "refused"}</li>)}</ul></Card>
    </>
  );
}
