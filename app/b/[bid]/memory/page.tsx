import type { Metadata } from "next";
import Link from "next/link";
import { requireBusiness } from "@/lib/auth/guards";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "History" };

const LAYER: Record<string, { label: string; tone: "brand" | "trust" | "neutral" | "insight" | "opportunity" }> = {
  verified: { label: "verified", tone: "brand" }, confirmed: { label: "confirmed by you", tone: "trust" },
  observed: { label: "measured", tone: "neutral" }, derived: { label: "pattern", tone: "opportunity" }, inferred: { label: "Foundry's suggestion", tone: "insight" },
};

export default async function MemoryPage({ params, searchParams }: { params: Promise<{ bid: string }>; searchParams: Promise<{ all?: string }> }) {
  const { bid } = await params;
  const { all } = await searchParams;
  const { supabase } = await requireBusiness(bid);
  await supabase.rpc("refresh_business_memory", { p_business_id: bid });
  const { data: entries } = await supabase.rpc("memory_timeline", { p_business_id: bid, p_limit: 200, p_include_inferred: all === "1" });
  return (
    <>
      <PageHeader eyebrow="History" title="Your business over time"
        description="What happened, what you decided and what came of it. Facts are labelled by how they are backed; Foundry's own suggestions are shown separately." />
      <Link href={all === "1" ? "?" : "?all=1"} className="mb-4 inline-block text-sm font-medium text-primary hover:underline">
        {all === "1" ? "Hide Foundry's suggestions" : "Also show Foundry's suggestions"}</Link>
      <ol className="glass divide-y text-sm" aria-label="Timeline">
        {entries?.map((e) => (
          <li key={e.id} className="flex flex-wrap items-center gap-2 p-3" aria-label={e.title}>
            <span className="w-24 text-xs text-muted-foreground">{formatDate(e.occurred_at)}</span>
            <span className="flex-1">{e.title}</span>
            <Badge tone={LAYER[e.layer]?.tone ?? "neutral"}>{LAYER[e.layer]?.label ?? e.layer}</Badge>
          </li>
        ))}
        {!entries?.length && <li className="p-6 text-muted-foreground">Your history builds up as you record.</li>}
      </ol>
    </>
  );
}
