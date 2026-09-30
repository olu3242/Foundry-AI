import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { SimpleShell } from "@/components/shell/simple-shell";
import { PageHeader } from "@/components/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { RegisterVerifierForm } from "@/components/trust/register-verifier-form";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { attest, correct } from "./actions";

export const metadata: Metadata = { title: "Verify" };

type Evidence = { business: string; claim: Record<string, string | number>; access_expires_at: string;
  records: { date: string; total_minor: number; payment_method: string; provenance: string }[] | null };

const RESULTS = <><option value="confirmed">Confirmed</option><option value="partially_confirmed">Partially confirmed</option><option value="not_confirmed">Not confirmed</option></>;

export default async function VerifyPage() {
  const user = await requireUser("/verify");
  const supabase = await createClient();
  const { data: memberships } = await supabase.from("verifier_members").select("verifier_id, verifiers(*)").eq("user_id", user.id);
  const verifiers = (memberships ?? []).map((m) => m.verifiers).filter((v): v is NonNullable<typeof v> => Boolean(v));
  const ids = verifiers.map((v) => v.id);
  const [{ data: requests }, { data: attestations }] = await Promise.all([
    supabase.from("verification_requests").select("id, claim_type, created_at, verifier_id").in("verifier_id", ids).eq("status", "requested").order("created_at"),
    supabase.rpc("verifier_attestations"),
  ]);
  const evidence = await Promise.all((requests ?? []).map(async (r) => (await supabase.rpc("verification_request_evidence", { p_request_id: r.id })).data as unknown as Evidence | null));

  return (
    <SimpleShell>
      <PageHeader eyebrow="Verify" title="Verification requests"
        description="Businesses ask you to check one specific claim. You see only the records needed for it, and only until you answer." />
      {!verifiers.length ? (
        <Card className="max-w-lg"><CardHeader><CardTitle>Become a verifier</CardTitle></CardHeader><RegisterVerifierForm /></Card>
      ) : (
        <div className="space-y-6">
          <p className="flex flex-wrap gap-2 text-sm">{verifiers.map((v) => <Badge key={v.id} tone={v.status === "approved" ? "brand" : "neutral"}>{v.name}: {v.status}</Badge>)}</p>
          {(requests ?? []).map((r, i) => {
            const e = evidence[i];
            if (!e) return null;
            return (
              <Card key={r.id} aria-label={`Request from ${e.business}`}>
                <CardHeader><CardTitle>{e.business}</CardTitle>
                  <CardDescription>{r.claim_type === "sales_total_period"
                    ? `Claims ${formatMoney(Number(e.claim.total_minor), String(e.claim.currency))} in sales from ${e.claim.period_start} to ${e.claim.period_end} (${e.claim.count} sales)`
                    : `Claims registration ${e.claim.type}: ${e.claim.value}`} · access until {formatDate(e.access_expires_at)}</CardDescription></CardHeader>
                {e.records && (
                  <table className="mb-4 w-full text-xs"><thead><tr className="text-left text-muted-foreground"><th>Date</th><th>Amount</th><th>Paid by</th><th>Proof</th></tr></thead>
                    <tbody>{e.records.map((x, j) => <tr key={j}><td>{x.date}</td><td>{formatMoney(x.total_minor, String(e.claim.currency))}</td><td>{x.payment_method}</td><td>{x.provenance.replaceAll("_", " ")}</td></tr>)}</tbody></table>
                )}
                <form action={attest} className="flex flex-wrap gap-2">
                  <input type="hidden" name="id" value={r.id} />
                  <Select name="result" aria-label="Result" className="h-9 w-44 text-xs">{RESULTS}</Select>
                  <Select name="method" aria-label="Method" className="h-9 w-48 text-xs">
                    <option value="mobile_money_statement">Mobile money statement</option><option value="bank_statement">Bank statement</option>
                    <option value="records_review">Records review</option><option value="registry_check">Registry check</option><option value="site_visit">Site visit</option></Select>
                  <input name="note" aria-label="Note" placeholder="Note" className="h-9 flex-1 rounded-md border bg-transparent px-2 text-xs" />
                  <Button size="sm">Submit attestation</Button>
                </form>
              </Card>
            );
          })}
          {!requests?.length && <p className="glass p-6 text-sm text-muted-foreground">No open requests.</p>}
          {!!attestations?.length && (
            <Card aria-label="Your attestations">
              <CardHeader><CardTitle>Your attestations</CardTitle><CardDescription>Correcting keeps the original in the history.</CardDescription></CardHeader>
              <ul className="divide-y text-sm">{attestations.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-2 py-2">
                  <span className="flex-1">{a.business_name} · {a.claim_type.replaceAll("_", " ")} · {a.result.replace("_", " ")}</span><Badge tone="neutral">{a.status}</Badge>
                  {["active", "disputed", "revoked"].includes(a.status) && (
                    <form action={correct} className="flex gap-1"><input type="hidden" name="id" value={a.id} />
                      <Select name="result" aria-label="Corrected result" className="h-8 w-40 text-xs">{RESULTS}</Select>
                      <input name="note" required minLength={3} aria-label="Correction note" placeholder="Why" className="h-8 w-32 rounded-md border bg-transparent px-2 text-xs" />
                      <Button size="sm" variant="outline">Correct</Button></form>
                  )}
                </li>))}</ul>
            </Card>
          )}
        </div>
      )}
    </SimpleShell>
  );
}
