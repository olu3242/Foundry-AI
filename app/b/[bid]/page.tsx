import Link from "next/link";
import { Loader2, TriangleAlert } from "lucide-react";
import { requireBusiness, WRITER_ROLES } from "@/lib/auth/guards";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { ActivityFeed } from "@/components/activity-feed";
import { AutoRefresh } from "@/components/auto-refresh";
import { CaptureComposer } from "@/components/capture/composer";
import { DraftCard, type DraftView } from "@/components/capture/draft-card";

export default async function TodayPage({ params }: { params: Promise<{ bid: string }> }) {
  const { bid } = await params;
  const { business, role, supabase } = await requireBusiness(bid);
  const canWrite = WRITER_ROLES.includes(role);

  const [{ data: captures }, { data: drafts }, { data: events }] = await Promise.all([
    supabase
      .from("captures")
      .select("id, status, raw_text, error, created_at")
      .eq("business_id", bid)
      .in("status", ["received", "processing", "failed"])
      .gte("created_at", new Date(Date.now() - 3 * 86_400_000).toISOString())
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("record_drafts")
      .select("id, kind, fields, confidence, evidence, explanation")
      .eq("business_id", bid)
      .eq("status", "proposed")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("events")
      .select("id, type, payload, actor_type, occurred_at")
      .eq("business_id", bid)
      .order("occurred_at", { ascending: false })
      .limit(15),
  ]);
  const inFlight = (captures ?? []).filter((c) => c.status !== "failed");
  const failed = (captures ?? []).filter((c) => c.status === "failed");

  return (
    <>
      <PageHeader eyebrow="Today" title={business.name} description="Say, type or photograph what happened. Foundry drafts the record; you confirm it." />
      <AutoRefresh active={inFlight.length > 0} />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section className="space-y-4" aria-label="Capture">
          {canWrite && <CaptureComposer businessId={bid} />}
          {inFlight.map((c) => (
            <div key={c.id} className="glass flex items-center gap-3 p-4 text-sm text-muted-foreground" role="status">
              <Loader2 className="size-4 animate-spin text-insight" aria-hidden />
              <span className="truncate">Reading “{c.raw_text ?? "photo"}”…</span>
            </div>
          ))}
          {failed.map((c) => (
            <div key={c.id} className="glass flex items-start gap-3 p-4 text-sm" role="alert">
              <TriangleAlert className="mt-0.5 size-4 text-orange-ink" aria-hidden />
              <div className="flex-1">
                <p>{c.error}</p>
                {c.raw_text && <p className="mt-1 text-muted-foreground">“{c.raw_text}”</p>}
              </div>
              <Link href={`/b/${bid}/records`} className="shrink-0 font-medium text-growth hover:underline">Enter by hand</Link>
            </div>
          ))}
          {(drafts ?? []).map((d) => (
            <DraftCard key={d.id} businessId={bid} currency={business.currency} draft={{
              ...d,
              confidence: Number(d.confidence),
              fields: d.fields as Record<string, unknown>,
              evidence: (Array.isArray(d.evidence) ? d.evidence : []) as DraftView["evidence"],
            }} />
          ))}
        </section>
        <Card className="h-fit">
          <CardHeader><CardTitle>Recent activity</CardTitle></CardHeader>
          <ActivityFeed events={events ?? []} />
        </Card>
      </div>
    </>
  );
}
