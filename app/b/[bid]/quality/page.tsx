import type { Metadata } from "next";
import { requireBusiness, WRITER_ROLES } from "@/lib/auth/guards";
import { PageHeader } from "@/components/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";
import { resolveIssue, scanQuality } from "./actions";

export const metadata: Metadata = { title: "Data health" };

type Dim = { score: number | null } & Record<string, unknown>;
type Score = { overall: number | null; records: number; note?: string; open_issues?: number; dimensions: Record<string, Dim | null> };

const DIM_LABEL: Record<string, [string, string]> = {
  completeness: ["Completeness", "Weeks with records, or explained as no trading"],
  consistency: ["Consistency", "No open duplicates or conflicts"],
  recency: ["Recency", "How recently you recorded"],
  provenance: ["Proof", "Records backed by a document or better"],
  verification: ["Verification", "Sales checked by a verifier"],
};

function IssueForm({ bid, id, action, children }: { bid: string; id: string; action: string; children: React.ReactNode }) {
  return (
    <form action={resolveIssue} className="flex gap-1">
      <input type="hidden" name="businessId" value={bid} /><input type="hidden" name="id" value={id} /><input type="hidden" name="action" value={action} />
      {children}
    </form>
  );
}

export default async function QualityPage({ params }: { params: Promise<{ bid: string }> }) {
  const { bid } = await params;
  const { role, supabase } = await requireBusiness(bid);
  const canWrite = WRITER_ROLES.includes(role);
  const [{ data }, { data: issues }, { data: corrections }] = await Promise.all([
    supabase.rpc("data_quality_score", { p_business_id: bid }),
    supabase.from("data_quality_issues").select("id, kind, subject, detail, detected_at").eq("business_id", bid).eq("status", "open").order("detected_at"),
    supabase.from("record_corrections").select("id, subject_type, action, reason, before, after, corrected_at").eq("business_id", bid).order("corrected_at", { ascending: false }).limit(20),
  ]);
  const s = data as unknown as Score;
  const pct = (v: number | null | undefined) => (v == null ? "unknown" : `${Math.round(v * 100)}%`);

  return (
    <>
      <PageHeader eyebrow="Data health" title="How complete and reliable your books are"
        description="Gaps are never filled in for you. Fix a duplicate, explain a quiet week, or count your stock — the original records stay in your history." />
      {canWrite && <form action={scanQuality} className="mb-4"><input type="hidden" name="businessId" value={bid} /><Button size="sm">Check my books</Button></form>}
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6" aria-label="Quality dimensions">
        <Card><CardDescription>Overall</CardDescription><p className="text-2xl font-semibold" data-testid="quality-overall">{pct(s.overall)}</p></Card>
        {Object.entries(s.dimensions).map(([k, d]) => (
          <Card key={k}><CardDescription title={DIM_LABEL[k]?.[1]}>{DIM_LABEL[k]?.[0] ?? k}</CardDescription>
            <p className="text-2xl font-semibold" data-testid={`quality-${k}`}>{pct(d?.score)}</p></Card>
        ))}
      </div>
      {s.note && <p className="mt-3 text-sm text-muted-foreground">{s.note}</p>}

      <Card className="mt-6" aria-label="Open issues">
        <CardHeader><CardTitle>To check</CardTitle></CardHeader>
        <ul className="divide-y text-sm">
          {issues?.map((i) => {
            const subject = i.subject as { ids?: string[]; week_start?: string };
            return (
              <li key={i.id} className="flex flex-wrap items-center gap-2 py-3" aria-label={i.detail}>
                <Badge tone="neutral">{i.kind.replace("_", " ")}</Badge><span className="flex-1">{i.detail}</span>
                {canWrite && (
                  <div className="flex flex-wrap gap-1">
                    {i.kind === "duplicate" && <>
                      <IssueForm bid={bid} id={i.id} action="void_duplicate"><input type="hidden" name="recordId" value={subject.ids?.[1]} /><Button size="sm">Remove the second one</Button></IssueForm>
                      <IssueForm bid={bid} id={i.id} action="not_duplicate"><Button size="sm" variant="outline">Both are real</Button></IssueForm></>}
                    {i.kind === "missing_period" && (
                      <IssueForm bid={bid} id={i.id} action="explain_gap">
                        <Select name="reason" aria-label="Why no records" className="h-8 w-36 text-xs"><option value="closed">We were closed</option><option value="travel">I was travelling</option><option value="holiday">Holiday</option><option value="stock_out">No stock</option><option value="other">Other</option></Select>
                        <Button size="sm" variant="outline">Explain</Button></IssueForm>)}
                    {i.kind === "conflict" && (
                      <IssueForm bid={bid} id={i.id} action="adjust_stock">
                        <Input name="counted" type="number" min="0" step="any" aria-label="How many you counted" placeholder="Counted" required className="h-8 w-24 text-xs" />
                        <Button size="sm" variant="outline">Save count</Button></IssueForm>)}
                    {i.kind === "stale" && <IssueForm bid={bid} id={i.id} action="dismiss"><Button size="sm" variant="outline">Dismiss</Button></IssueForm>}
                  </div>
                )}
              </li>
            );
          })}
          {!issues?.length && <li className="py-3 text-muted-foreground">Nothing to check.</li>}
        </ul>
      </Card>

      {!!corrections?.length && (
        <Card className="mt-6" aria-label="Correction history">
          <CardHeader><CardTitle>Correction history</CardTitle><CardDescription>Every change, with what it was before.</CardDescription></CardHeader>
          <ul className="divide-y text-sm">{corrections.map((c) => {
            const b = c.before as Record<string, unknown> | null; const a = c.after as Record<string, unknown> | null;
            return <li key={c.id} className="py-2">{c.subject_type} · {c.action.replace("_", " ")}{c.reason ? ` · “${c.reason}”` : ""} · {formatDate(c.corrected_at)}
              {c.action === "correct" && <span className="block text-xs text-muted-foreground">amount {String(b?.total_minor ?? b?.amount_minor)} → {String(a?.total_minor ?? a?.amount_minor)} (minor units)</span>}</li>;
          })}</ul>
        </Card>
      )}
    </>
  );
}
