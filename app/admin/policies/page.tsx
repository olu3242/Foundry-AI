import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PolicyForm } from "@/components/admin/policy-form";
import { formatDate } from "@/lib/utils";
import { activatePolicy } from "../actions";

export const metadata: Metadata = { title: "Policies" };

export default async function PoliciesPage() {
  const supabase = await createClient();
  const [{ data: policies }, { data: decisions }] = await Promise.all([
    supabase.from("policies").select("id, key, scope_type, scope_id, version, status, note, definition, activated_at").order("key").order("scope_type").order("version", { ascending: false }),
    supabase.from("policy_decisions").select("id, policy_key, version, scope, result, reason, decided_at").order("decided_at", { ascending: false }).limit(25),
  ]);
  return (
    <>
      <PageHeader eyebrow="Admin" title="Policies" description="Versioned rules at global, market, program, provider or solution scope. Layers combine: deny wins, AI caps take the lowest. Every evaluation is logged." />
      <Card aria-label="New policy version"><CardHeader><CardTitle>New version</CardTitle></CardHeader><PolicyForm /></Card>
      <Card className="mt-6" aria-label="Policy versions">
        <CardHeader><CardTitle>Versions</CardTitle></CardHeader>
        <ul className="divide-y text-sm">{policies?.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-2 py-2" aria-label={`${p.key} ${p.scope_type}:${p.scope_id} v${p.version}`}>
            <span className="flex-1">{p.key} · {p.scope_type}:{p.scope_id} · v{p.version}{p.note ? ` · ${p.note}` : ""}</span>
            <Badge tone={p.status === "active" ? "brand" : "neutral"}>{p.status}</Badge>
            {p.status !== "active" && <form action={activatePolicy}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="op" value="activate" /><Button size="sm" variant="outline">Activate</Button></form>}
            {p.status === "active" && <form action={activatePolicy}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="op" value="retire" /><Button size="sm" variant="ghost">Retire</Button></form>}
          </li>))}</ul>
      </Card>
      <Card className="mt-6" aria-label="Decision log">
        <CardHeader><CardTitle>Recent decisions</CardTitle><CardDescription>Policy, version, scope, result and reason for each evaluation.</CardDescription></CardHeader>
        <ul className="divide-y text-xs">{decisions?.map((d) => (
          <li key={d.id} className="py-1.5">{formatDate(d.decided_at)} · {d.policy_key} v{d.version} ({d.scope}) → <b>{d.result}</b>{d.reason ? ` · ${d.reason}` : ""}</li>))}
          {!decisions?.length && <li className="py-2 text-muted-foreground">None yet.</li>}</ul>
      </Card>
    </>
  );
}
