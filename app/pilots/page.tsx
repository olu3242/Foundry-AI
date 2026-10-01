import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { SimpleShell } from "@/components/shell/simple-shell";
import { PageHeader } from "@/components/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreatePilotForm } from "@/components/pilots/forms";

export const metadata: Metadata = { title: "Pilots" };

export default async function PilotsPage() {
  await requireUser("/pilots");
  const supabase = await createClient();
  const [{ data: pilots }, { data: isAdmin }] = await Promise.all([
    supabase.from("pilots").select("id, name, status, target_size, starts_on, ends_on, country_code").order("created_at", { ascending: false }),
    supabase.rpc("am_platform_admin"),
  ]);
  return (
    <SimpleShell>
      <PageHeader eyebrow="Pilots" title="Pilot operations" description="Cohorts run on configuration: who, where, how long, what counts as success. Stages update daily from live records; only real businesses count as evidence." />
      <ul className="glass mb-6 divide-y text-sm">{pilots?.map((p) => (
        <li key={p.id} className="flex flex-wrap items-center gap-2 p-3"><Link className="font-medium hover:underline" href={`/pilots/${p.id}`}>{p.name}</Link>
          <Badge tone={p.status === "active" ? "brand" : "neutral"}>{p.status}</Badge>
          <span className="text-xs text-muted-foreground">{p.country_code ?? "any market"} · {p.target_size} businesses · {p.starts_on} → {p.ends_on}</span></li>))}
        {!pilots?.length && <li className="p-3 text-muted-foreground">No pilots yet.</li>}</ul>
      {isAdmin && <Card><CardHeader><CardTitle>New pilot</CardTitle><CardDescription>Built on a program: businesses join with its code and consent, then enter the pilot if eligible.</CardDescription></CardHeader><CreatePilotForm /></Card>}
    </SimpleShell>
  );
}
