import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { certifyMarketProof, harvestEvidence } from "../actions";
import { EvidenceForm } from "./evidence-form";

export const metadata: Metadata = { title: "Real-world evidence" };

type C = { overall: string; technical: string; note: string; real_businesses: number; test_businesses_excluded: number; environment: string;
  claims: { claim: string; status: string; n: number | null; value: number | null; threshold: { min_n: number; proven: number; failed: number } }[];
  evidence: Record<string, Record<string, unknown>> };

const tone = (s: string) => (s === "PROVEN" ? "brand" : s === "FAILED" ? "attention" : s === "PARTIALLY PROVEN" ? "opportunity" : "neutral");

export default async function EvidencePage() {
  const supabase = await createClient();
  const [{ data }, { data: register }, { data: history }] = await Promise.all([
    supabase.rpc("real_world_certification"),
    supabase.from("evidence_register").select("*").order("date", { ascending: false }).limit(50),
    supabase.from("real_world_certifications").select("taken_at, overall, technical").order("taken_at", { ascending: false }).limit(5),
  ]);
  const c = data as unknown as C;
  const [{ data: mp }, { data: mpHistory }] = await Promise.all([
    supabase.rpc("market_proof_certification"),
    supabase.from("market_proof_certifications").select("taken_at, verdict").order("taken_at", { ascending: false }).limit(5),
  ]);
  const m = mp as unknown as { verdict: string; technical: string; real_businesses: number; environment: string; open_p0_p1_gaps: number; note: string;
    proofs: { proof: string; status: string; n: number | null; value: number | null }[] };
  const mtone = (st: string) => tone(st.replaceAll("_", " "));
  return (
    <>
      <PageHeader eyebrow="Admin · B46–B50" title="Real-world evidence and certification" description={c.note} />
      <Card className="mb-6" aria-label="Certification">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">Real-world: <Badge tone={tone(c.overall)} data-testid="overall">{c.overall}</Badge>
            Technical: <Badge tone={c.technical === "PASS" ? "brand" : "attention"} data-testid="technical">{c.technical}</Badge></CardTitle>
          <CardDescription>Environment {c.environment} · real businesses {c.real_businesses} · test-data businesses excluded {c.test_businesses_excluded}</CardDescription>
        </CardHeader>
        <table className="w-full text-sm"><thead><tr className="text-left text-xs text-muted-foreground"><th>Claim</th><th>Status</th><th>n</th><th>Value</th><th>Needs</th></tr></thead>
          <tbody>{c.claims.map((x) => (
            <tr key={x.claim} aria-label={`Claim ${x.claim}`}><td>{x.claim.replaceAll("_", " ")}</td><td><Badge tone={tone(x.status)} data-testid="claim-status">{x.status}</Badge></td>
              <td>{x.n ?? 0}</td><td>{x.value ?? "—"}</td><td className="text-xs text-muted-foreground">n ≥ {x.threshold.min_n}, value ≥ {x.threshold.proven}</td></tr>))}</tbody></table>
        <form action={harvestEvidence} className="mt-4"><Button size="sm" variant="outline">Harvest evidence and certify now</Button></form>
        {!!history?.length && <p className="mt-2 text-xs text-muted-foreground">History: {history.map((h) => `${formatDate(h.taken_at)} ${h.overall} (technical ${h.technical})`).join(" · ")}</p>}
      </Card>
      <Card className="mb-6" aria-label="Market proof">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">B60 market proof: <Badge tone={mtone(m.verdict)} data-testid="market-verdict">{m.verdict}</Badge></CardTitle>
          <CardDescription>{m.note} · real businesses {m.real_businesses} · open P0/P1 gaps {m.open_p0_p1_gaps}</CardDescription>
        </CardHeader>
        <table className="w-full text-sm"><thead><tr className="text-left text-xs text-muted-foreground"><th>Proof</th><th>Status</th><th>n</th><th>Value</th></tr></thead>
          <tbody>{m.proofs.map((x) => (
            <tr key={x.proof} aria-label={`Proof ${x.proof}`}><td>{x.proof}</td><td><Badge tone={mtone(x.status)} data-testid="proof-status">{x.status}</Badge></td>
              <td>{x.n ?? 0}</td><td>{x.value ?? "—"}</td></tr>))}</tbody></table>
        <form action={certifyMarketProof} className="mt-4"><Button size="sm" variant="outline">Certify market proof now</Button></form>
        {!!mpHistory?.length && <p className="mt-2 text-xs text-muted-foreground">History: {mpHistory.map((h) => `${formatDate(h.taken_at)} ${h.verdict}`).join(" · ")}</p>}
      </Card>
      <Card className="mb-6" aria-label="Evidence register">
        <CardHeader><CardTitle>Evidence register</CardTitle><CardDescription>Only real, consenting businesses. Harvested daily from system records; documented external evidence can be added below.</CardDescription></CardHeader>
        <table className="w-full text-xs"><thead><tr className="text-left text-muted-foreground"><th>ID</th><th>Batch</th><th>Claim</th><th>Source</th><th>Date</th><th>Verification</th><th>Consent</th><th>Outcome</th><th>Confidence</th></tr></thead>
          <tbody>{(register ?? []).map((e) => (
            <tr key={e.evidence_id}><td className="font-mono">{e.evidence_id}</td><td>{e.batch}</td><td>{e.claim}</td><td className="font-mono">{e.source}</td><td>{e.date}</td>
              <td>{e.verification_state.replaceAll("_", " ")}</td><td>{e.consent_scope}</td><td>{e.outcome}</td><td>{e.confidence}</td></tr>))}
            {!register?.length && <tr><td colSpan={9} className="py-2 text-muted-foreground" data-testid="register-empty">No real-world evidence yet.</td></tr>}</tbody></table>
      </Card>
      <Card><CardHeader><CardTitle>Record documented evidence</CardTitle><CardDescription>Refused for test data, missing consent, missing source document or future dates.</CardDescription></CardHeader><EvidenceForm /></Card>
    </>
  );
}
