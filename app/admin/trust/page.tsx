import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { resolveDispute, reviewVerifier } from "../actions";

export const metadata: Metadata = { title: "Trust" };

export default async function TrustPage() {
  const supabase = await createClient();
  const [{ data: verifiers }, { data: disputes }] = await Promise.all([
    supabase.from("verifiers").select("id, name, kind, accreditation, allowed_claims, status").order("created_at", { ascending: false }),
    supabase.from("attestation_disputes").select("id, reason, status, created_at, attestations(claim_type, result, verifiers(name))").eq("status", "open"),
  ]);
  return (
    <>
      <PageHeader eyebrow="Admin" title="Trust network" description="Verifiers attest to specific claims only. There is no blanket trusted status for any business." />
      <Card aria-label="Verifiers">
        <CardHeader><CardTitle>Verifiers</CardTitle></CardHeader>
        <ul className="divide-y text-sm">{verifiers?.map((v) => (
          <li key={v.id} className="flex flex-wrap items-center gap-2 py-2" aria-label={`Verifier ${v.name}`}>
            <span className="flex-1">{v.name} · {v.kind} · {v.allowed_claims.join(", ")}{v.accreditation ? ` · ${v.accreditation}` : ""}</span>
            <Badge tone={v.status === "approved" ? "brand" : "neutral"}>{v.status}</Badge>
            <form action={reviewVerifier}><input type="hidden" name="id" value={v.id} />
              <input type="hidden" name="status" value={v.status === "approved" ? "suspended" : "approved"} />
              <Button size="sm" variant="outline">{v.status === "approved" ? "Suspend" : "Approve"}</Button></form>
          </li>))}</ul>
      </Card>
      <Card className="mt-6" aria-label="Open disputes">
        <CardHeader><CardTitle>Open disputes</CardTitle></CardHeader>
        <ul className="divide-y text-sm">{disputes?.map((d) => (
          <li key={d.id} className="py-2">
            <p>{d.attestations?.verifiers?.name} · {d.attestations?.claim_type} ({d.attestations?.result}): {d.reason}</p>
            <form action={resolveDispute} className="mt-1 flex gap-2"><input type="hidden" name="id" value={d.id} />
              <Select name="decision" aria-label="Decision" className="h-8 w-32 text-xs"><option value="upheld">Uphold</option><option value="rejected">Reject</option></Select>
              <input name="resolution" required minLength={3} aria-label="Resolution" className="h-8 flex-1 rounded-md border bg-transparent px-2 text-xs" />
              <Button size="sm" variant="outline">Resolve</Button></form>
          </li>))}
          {!disputes?.length && <li className="py-2 text-muted-foreground">None.</li>}</ul>
      </Card>
    </>
  );
}
