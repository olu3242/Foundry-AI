import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, CircleSlash, Search, Sparkles } from "lucide-react";
import { requireBusiness, WRITER_ROLES } from "@/lib/auth/guards";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PostOpportunity } from "@/components/agent/post-opportunity";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { findMatches, respondToMatch } from "./actions";

export const metadata: Metadata = { title: "Market" };

const CATEGORY: Record<string, string> = {
  supply_contract: "Supply contract", buyer_request: "Buyer request", financing: "Financing", training: "Training", grant: "Grant", other: "Other",
};

export default async function MarketPage({ params }: { params: Promise<{ bid: string }> }) {
  const { bid } = await params;
  const { business, role, supabase } = await requireBusiness(bid);
  const canAct = WRITER_ROLES.includes(role);
  const { data: matches } = await supabase
    .from("opportunity_matches")
    .select("score, eligible, reasons, gaps, status, opportunities!inner(id, title, description, category, budget_min_minor, budget_max_minor, currency, deadline, contact, is_sample, status)")
    .eq("business_id", bid).neq("status", "dismissed").eq("opportunities.status", "open")
    .order("eligible", { ascending: false }).order("score", { ascending: false }).limit(30);

  return (
    <>
      <PageHeader eyebrow="Market" title="Opportunities that fit"
        description="Contracts, buyers and programs matched to what your records can prove. Each match says why it fits, and what's missing if you don't qualify yet."
        actions={
          <div className="flex gap-2">
            {role === "owner" && <PostOpportunity businessId={bid} currency={business.currency} />}
            <form action={findMatches}><input type="hidden" name="businessId" value={bid} /><Button size="sm" variant="outline"><Search /> Find matches</Button></form>
          </div>
        } />
      {!matches?.length && <p className="glass p-6 text-sm text-muted-foreground">No matches yet. Press “Find matches” once you have a few records.</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        {matches?.map((m) => {
          const o = m.opportunities;
          const reasons = m.reasons as string[];
          const gaps = m.gaps as string[];
          const budget = o.budget_max_minor && o.currency ? `${o.budget_min_minor ? `${formatMoney(o.budget_min_minor, o.currency)} – ` : "up to "}${formatMoney(o.budget_max_minor, o.currency)}` : null;
          return (
            <article key={o.id} className="glass flex flex-col gap-3 p-5" aria-label={o.title}>
              <header className="flex flex-wrap items-center gap-2">
                <Badge tone="opportunity">{CATEGORY[o.category]}</Badge>
                {o.is_sample && <Badge>Sample</Badge>}
                {m.status === "interested" && <Badge tone="brand"><CheckCircle2 className="size-3" aria-hidden /> You&apos;re interested</Badge>}
                <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground"><Sparkles className="size-3 text-insight" aria-hidden /> Fit {m.score}/100</span>
              </header>
              <h2 className="text-lg font-semibold leading-snug">{o.title}</h2>
              <p className="text-sm text-muted-foreground">{o.description}</p>
              <p className="text-xs text-muted-foreground">{[budget, o.deadline && `Closes ${formatDate(o.deadline)}`].filter(Boolean).join(" · ")}</p>
              {!!reasons.length && <ul className="space-y-1 text-sm">{reasons.map((r) => <li key={r} className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-growth" aria-hidden />{r}</li>)}</ul>}
              {!!gaps.length && <ul className="space-y-1 text-sm">{gaps.map((g) => <li key={g} className="flex gap-2"><CircleSlash className="mt-0.5 size-4 shrink-0 text-orange-ink" aria-hidden />{g}</li>)}</ul>}
              {!m.eligible && <Link href={`/b/${bid}/passport`} className="text-sm font-medium text-growth hover:underline">Strengthen your Passport →</Link>}
              {canAct && (
                <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
                  {m.status !== "interested" ? (
                    <form action={respondToMatch}><input type="hidden" name="businessId" value={bid} /><input type="hidden" name="opportunityId" value={o.id} /><input type="hidden" name="status" value="interested" />
                      <Button size="sm" disabled={!m.eligible}>I&apos;m interested</Button></form>
                  ) : o.contact && <p className="text-sm">Contact: <span className="font-medium">{o.contact}</span>. Share your Passport with them from the Passport page.</p>}
                  <form action={respondToMatch}><input type="hidden" name="businessId" value={bid} /><input type="hidden" name="opportunityId" value={o.id} /><input type="hidden" name="status" value="dismissed" />
                    <Button size="sm" variant="ghost">Not for me</Button></form>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </>
  );
}
