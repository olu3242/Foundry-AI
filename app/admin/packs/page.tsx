import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PackForm } from "@/components/admin/pack-form";

export const metadata: Metadata = { title: "Packs" };

export default async function PacksPage() {
  const supabase = await createClient();
  const [{ data: packs }, { data: usage }] = await Promise.all([
    supabase.from("vertical_packs").select("key, name, version, status, definition").order("name"),
    supabase.from("business_packs").select("pack_key"),
  ]);
  return (
    <>
      <PageHeader eyebrow="Admin" title="Vertical packs" description="A vertical is configuration: entities, metrics (supported sources only), Pulse rules, solutions, evidence, benchmarks and workflows. No code changes." />
      <div className="grid gap-4 lg:grid-cols-2">
        {packs?.map((p) => (
          <Card key={p.key} aria-label={`Pack ${p.key}`}>
            <CardHeader><CardTitle>{p.name} · v{p.version}</CardTitle>
              <CardDescription>{(usage ?? []).filter((u) => u.pack_key === p.key).length} business(es) · {p.status}</CardDescription></CardHeader>
            <PackForm initial={{ key: p.key, name: p.name, definition: p.definition }} />
          </Card>
        ))}
        <Card aria-label="New pack"><CardHeader><CardTitle>New pack</CardTitle></CardHeader><PackForm /></Card>
      </div>
    </>
  );
}
