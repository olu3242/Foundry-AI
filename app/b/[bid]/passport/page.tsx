import type { Metadata } from "next";
import { requireBusiness, WRITER_ROLES } from "@/lib/auth/guards";
import { PageHeader } from "@/components/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PassportView } from "@/components/passport/passport-view";
import { ShareForm } from "@/components/passport/share-form";
import { ProofForm } from "@/components/passport/proof-form";
import { VouchForm } from "@/components/passport/vouch-form";
import { loadPassport, PASSPORT_SECTIONS, SECTION_LABEL, type PassportSection } from "@/lib/passport/facts";
import { formatDate } from "@/lib/utils";
import { disputeAttestation, revokeShare } from "./actions";
import { RequestVerificationForm } from "@/components/trust/request-verification-form";

type Attestation = { id: string; verifier: string; verifier_kind: string; claim_type: string; claim: Record<string, string | number>; result: string;
  method: string; note: string | null; status: string; supersedes: string | null; attested_at: string; valid_until: string;
  disputes: { id: string; reason: string; status: string; resolution: string | null }[] };

function claimLabel(a: Pick<Attestation, "claim_type" | "claim">) {
  return a.claim_type === "sales_total_period"
    ? `Sales ${a.claim.period_start} → ${a.claim.period_end}: ${a.claim.count} sales`
    : `Registration ${a.claim.type}: ${a.claim.value}`;
}

export const metadata: Metadata = { title: "Passport" };

export default async function PassportPage({ params }: { params: Promise<{ bid: string }> }) {
  const { bid } = await params;
  const { role, supabase } = await requireBusiness(bid);
  const { facts, pulse } = await loadPassport(bid, PASSPORT_SECTIONS);
  const isOwner = role === "owner";
  const { data: shares } = isOwner
    ? await supabase.from("passport_shares").select("id, label, sections, expires_at, revoked_at, view_count, last_viewed_at").eq("business_id", bid).order("created_at", { ascending: false })
    : { data: [] };
  const now = Date.now();
  const [{ data: history }, { data: verifiers }, { data: identifiers }, { data: pendingRequests }] = await Promise.all([
    supabase.rpc("verification_history", { p_business_id: bid }),
    isOwner ? supabase.from("verifiers").select("id, name, kind, allowed_claims").eq("status", "approved") : Promise.resolve({ data: [] }),
    supabase.from("business_identifiers").select("type").eq("business_id", bid),
    supabase.from("verification_requests").select("id, claim_type, created_at, verifiers(name)").eq("business_id", bid).eq("status", "requested"),
  ]);
  const attestations = (history ?? []) as unknown as Attestation[];

  return (
    <>
      <PageHeader eyebrow="Passport" title="Your proof, on your terms"
        description="Share your track record with a bank, supplier or program. You choose what they see and for how long, and you can switch a link off at any time." />
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <PassportView facts={facts} pulse={pulse} sections={PASSPORT_SECTIONS} />
        <div className="space-y-6">
          {WRITER_ROLES.includes(role) && (
            <Card>
              <CardHeader><CardTitle>Add proof</CardTitle><CardDescription>Statements, invoices or registration move you up the ladder. Documents stay private; share links only show that proof exists.</CardDescription></CardHeader>
              <ProofForm businessId={bid} />
            </Card>
          )}
          {(role === "partner" || role === "program_admin") && (
            <Card>
              <CardHeader><CardTitle>Vouch for this business</CardTitle><CardDescription>Your verification appears on its Passport with your role, never your personal details.</CardDescription></CardHeader>
              <VouchForm businessId={bid} isProgramAdmin={role === "program_admin"} />
            </Card>
          )}
          <Card aria-label="Independent verification">
            <CardHeader><CardTitle>Independent verification</CardTitle>
              <CardDescription>A verifier checks one specific claim using only the records it needs. Each check expires and can be disputed.</CardDescription></CardHeader>
            {isOwner && <RequestVerificationForm businessId={bid} verifiers={verifiers ?? []} identifiers={(identifiers ?? []).map((i) => i.type)} />}
            {!!pendingRequests?.length && (
              <ul className="mt-4 space-y-1 text-xs text-muted-foreground">{pendingRequests.map((r) => <li key={r.id}>Waiting: {r.verifiers?.name} · {r.claim_type.replaceAll("_", " ")}</li>)}</ul>
            )}
            <ul className="mt-4 divide-y text-sm">
              {attestations.map((a) => (
                <li key={a.id} className="py-3" aria-label={`Attestation by ${a.verifier}`}>
                  <p className="flex flex-wrap items-center gap-2"><span className="font-medium">{a.verifier}</span>
                    <Badge tone={a.status === "active" && a.result === "confirmed" ? "brand" : "neutral"}>{a.result.replace("_", " ")}</Badge>
                    <Badge tone="neutral">{a.status}</Badge></p>
                  <p className="text-xs text-muted-foreground">{claimLabel(a)} · {a.method.replaceAll("_", " ")} · valid until {formatDate(a.valid_until)}{a.supersedes ? " · correction" : ""}</p>
                  {a.disputes.map((d) => <p key={d.id} className="text-xs">Dispute ({d.status}): {d.reason}{d.resolution ? ` — ${d.resolution}` : ""}</p>)}
                  {isOwner && a.status === "active" && (
                    <form action={disputeAttestation} className="mt-2 flex gap-2">
                      <input type="hidden" name="businessId" value={bid} /><input type="hidden" name="id" value={a.id} />
                      <input name="reason" required minLength={5} aria-label="Dispute reason" placeholder="What is wrong?" className="h-8 flex-1 rounded-md border bg-transparent px-2 text-xs" />
                      <Button size="sm" variant="outline">Dispute</Button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          </Card>
          {isOwner && (
            <Card>
              <CardHeader><CardTitle>Share your Passport</CardTitle></CardHeader>
              <ShareForm businessId={bid} />
              {!!shares?.length && (
                <ul className="mt-6 divide-y text-sm">
                  {shares.map((s) => {
                    const active = !s.revoked_at && new Date(s.expires_at).getTime() > now;
                    return (
                      <li key={s.id} className="flex items-start gap-3 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{s.label}</p>
                          <p className="text-xs text-muted-foreground">
                            {s.sections.map((x) => SECTION_LABEL[x as PassportSection] ?? x).join(", ")} · {s.view_count} view{s.view_count === 1 ? "" : "s"}
                            {s.last_viewed_at ? `, last ${formatDate(s.last_viewed_at)}` : ""}
                          </p>
                        </div>
                        {active ? (
                          <form action={revokeShare}>
                            <input type="hidden" name="businessId" value={bid} />
                            <input type="hidden" name="shareId" value={s.id} />
                            <button className="text-xs font-medium text-destructive hover:underline">Switch off</button>
                          </form>
                        ) : <Badge>{s.revoked_at ? "Switched off" : "Expired"}</Badge>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
