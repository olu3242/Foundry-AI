import { StartPlanForm } from "@/components/progress/start-plan-form";
import { METRICS, type MetricKey } from "@/lib/interventions/catalog";

export type SolutionRow = {
  key: string; name: string; summary: string; target_metric: string; default_window_days: number;
  version_id: string; version: number; activated: number; completed: number; improved: number; verified: number; sample_ok: boolean;
  price?: string | null; provider?: string | null;
};

/** B13: every plan shows its track record; small samples say so instead of implying a result. */
export function SolutionList({ businessId, rows, canStart }: { businessId: string; rows: SolutionRow[]; canStart: boolean }) {
  return (
    <ul className="divide-y" aria-label="Proven plans">
      {rows.map((s) => (
        <li key={s.version_id} className="space-y-2 py-4" aria-label={s.name}>
          <div className="flex flex-wrap items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{s.name} <span className="text-xs text-muted-foreground">v{s.version}{s.provider ? ` · by ${s.provider}` : ""}{s.price ? ` · ${s.price}` : ""}</span></p>
              <p className="text-sm text-muted-foreground">{s.summary}</p>
              <p className="text-xs text-muted-foreground">Moves: {METRICS[s.target_metric as MetricKey]?.label} · {s.default_window_days} days</p>
            </div>
            {canStart && <StartPlanForm compact businessId={businessId} defaults={{ title: s.name, metric: s.target_metric, solutionVersionId: s.version_id, windowDays: s.default_window_days }} />}
          </div>
          <p className="text-xs" data-testid={`funnel-${s.key}`}>
            {s.activated} started · {s.completed} completed · {s.improved} improved · {s.verified} verified
            {!s.sample_ok && <span className="text-muted-foreground"> · too few completed plans to judge yet</span>}
          </p>
        </li>
      ))}
    </ul>
  );
}
