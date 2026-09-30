import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

export type BenchmarkRow = {
  metric: string; value: number; cohort: string; level: string; n: number; period_end: string; avg_quality: number;
  confidence: string; p25: number | null; p50: number | null; p75: number | null; placement: string | null;
};

const LABEL: Record<string, { label: string; pct: boolean }> = {
  margin: { label: "Kept after spending", pct: true },
  collection_rate: { label: "Sales collected", pct: true },
  active_days_30: { label: "Days with records", pct: false },
  repeat_share: { label: "Returning customers", pct: true },
  receivable_ratio: { label: "Owed vs monthly sales", pct: true },
};
const fmt = (metric: string, v: number | null) => (v === null ? "—" : LABEL[metric]?.pct ? `${Math.round(v * 100)}%` : String(Math.round(v)));
const CONF: Record<string, "neutral" | "opportunity" | "brand" | "trust"> = { none: "neutral", low: "opportunity", medium: "brand", high: "trust" };

/** B14: every figure carries its cohort, sample, period, record quality and confidence. No rankings. */
export function BenchmarkCard({ rows }: { rows: BenchmarkRow[] }) {
  return (
    <section className="glass mt-6 p-5" aria-labelledby="bench-title">
      <h2 id="bench-title" className="mb-1 flex items-center gap-2 font-semibold"><Users className="size-4 text-growth" aria-hidden /> Compared with similar businesses</h2>
      <p className="mb-4 text-xs text-muted-foreground">Only shown when enough comparable businesses exist. Never a ranking.</p>
      {!rows.length ? (
        <p className="text-sm text-muted-foreground">Not enough recent records yet to compare. Keep recording for a few days.</p>
      ) : (
        <ul className="divide-y text-sm">
          {rows.map((r) => (
            <li key={r.metric} className="grid gap-1 py-3 sm:grid-cols-[1fr_auto]" aria-label={LABEL[r.metric]?.label ?? r.metric}>
              <div>
                <p className="font-medium">{LABEL[r.metric]?.label ?? r.metric}: {fmt(r.metric, r.value)}</p>
                {r.confidence === "none" ? (
                  <p className="text-xs text-muted-foreground">Not enough similar businesses yet (need 10, have {r.n}).</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Middle half of similar businesses: {fmt(r.metric, r.p25)}–{fmt(r.metric, r.p75)} (typical {fmt(r.metric, r.p50)})
                    {r.placement ? ` · you are ${r.placement}` : ""}
                  </p>
                )}
                <p className="text-xs text-muted-foreground" data-testid="bench-meta">
                  Cohort {r.cohort} · {r.n} businesses · 30 days to {formatDate(r.period_end)} · record quality {Math.round(r.avg_quality * 100)}%
                </p>
              </div>
              <Badge tone={CONF[r.confidence]} className="h-fit">confidence: {r.confidence}</Badge>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
