import type { Metadata } from "next";
import { RefreshCw } from "lucide-react";
import { requireBusiness } from "@/lib/auth/guards";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { PulseCard, STATE_META, type PulseRow } from "@/components/pulse/pulse-card";
import { DIMENSIONS } from "@/lib/pulse/score";
import { refreshPulse } from "./actions";
import { BenchmarkCard, type BenchmarkRow } from "@/components/pulse/benchmark-card";

export const metadata: Metadata = { title: "Pulse" };

export default async function PulsePage({ params }: { params: Promise<{ bid: string }> }) {
  const { bid } = await params;
  const { supabase } = await requireBusiness(bid);
  const { data: latest } = await supabase
    .from("pulse_snapshots").select("computed_on").eq("business_id", bid).order("computed_on", { ascending: false }).limit(1).maybeSingle();
  const { data: rows } = latest
    ? await supabase.from("pulse_snapshots").select("dimension, score, state, trend, why, action, evidence, computed_at").eq("business_id", bid).eq("computed_on", latest.computed_on)
    : { data: [] };
  const { data: fb } = latest
    ? await supabase.from("pulse_feedback").select("dimension, verdict").eq("business_id", bid).eq("computed_on", latest.computed_on)
    : { data: [] };
  const { data: bench } = await supabase.rpc("business_benchmark", { p_business_id: bid });
  const ordered = DIMENSIONS.map((d) => rows?.find((r) => r.dimension === d)).filter(Boolean) as (PulseRow & { computed_at: string })[];
  const counts = ordered.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.state]: (acc[r.state] ?? 0) + 1 }), {});

  const refresh = (
    <form action={refreshPulse}>
      <input type="hidden" name="businessId" value={bid} />
      <Button variant="outline" size="sm"><RefreshCw /> Refresh</Button>
    </form>
  );

  return (
    <>
      <PageHeader
        eyebrow="Pulse"
        title="How your business is doing"
        description="Nine signals from your own records. Each one says what it's based on and what to do next. This is not a credit score."
        actions={refresh}
      />
      {!ordered.length ? (
        <p className="glass p-6 text-sm text-muted-foreground">Pulse appears after your first records. Record a few sales and expenses, then press Refresh.</p>
      ) : (
        <>
          <ul className="mb-6 flex flex-wrap gap-2" aria-label="Summary">
            {(["at_risk", "watch", "steady", "strong", "insufficient_data"] as const).filter((s) => counts[s]).map((s) => {
              const m = STATE_META[s];
              return (
                <li key={s} className={`glass flex items-center gap-2 px-3 py-1.5 text-sm ${m.tone}`}>
                  <m.Icon className="size-4" aria-hidden /> {counts[s]} {m.label.toLowerCase()}
                </li>
              );
            })}
            <li className="ml-auto self-center text-xs text-muted-foreground">
              Updated {new Date(ordered[0]!.computed_at).toLocaleString("en", { dateStyle: "medium", timeStyle: "short" })}
            </li>
          </ul>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {ordered.map((r) => (
              <PulseCard key={r.dimension} row={r}
                feedback={{ businessId: bid, computedOn: latest!.computed_on, given: fb?.find((f) => f.dimension === r.dimension)?.verdict }} />
            ))}
          </div>
          <BenchmarkCard rows={(bench ?? []) as BenchmarkRow[]} />
        </>
      )}
    </>
  );
}
