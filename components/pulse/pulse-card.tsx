import { ArrowDownRight, ArrowRight, ArrowUpRight, CircleDashed, Minus, OctagonAlert, ShieldCheck, TriangleAlert, Circle } from "lucide-react";
import { DIMENSION_LABEL, type Dimension, type PulseState, type PulseTrend } from "@/lib/pulse/score";
import { cn } from "@/lib/utils";
import { pulseFeedback } from "@/app/b/[bid]/progress/actions";

// Status is never colour-only: every state has its own label and icon shape.
export const STATE_META: Record<PulseState, { label: string; Icon: typeof Circle; tone: string; bar: string }> = {
  strong: { label: "Strong", Icon: ShieldCheck, tone: "text-growth", bar: "bg-growth" },
  steady: { label: "Steady", Icon: Circle, tone: "text-primary", bar: "bg-primary" },
  watch: { label: "Watch", Icon: TriangleAlert, tone: "text-gold-ink", bar: "bg-gold" },
  at_risk: { label: "Needs attention", Icon: OctagonAlert, tone: "text-orange-ink", bar: "bg-orange" },
  insufficient_data: { label: "Not enough data", Icon: CircleDashed, tone: "text-muted-foreground", bar: "bg-muted-foreground/40" },
};

const TREND: Record<PulseTrend, { label: string; Icon: typeof Minus } | null> = {
  up: { label: "Improving", Icon: ArrowUpRight },
  down: { label: "Worsening", Icon: ArrowDownRight },
  flat: { label: "About the same", Icon: ArrowRight },
  unknown: null,
};

export type PulseRow = {
  dimension: string; score: number | null; state: PulseState; trend: PulseTrend; why: string; action: string | null;
  evidence: Record<string, unknown>;
};

export function PulseCard({ row, feedback }: { row: PulseRow; feedback?: { businessId: string; computedOn: string; given?: string } }) {
  const meta = STATE_META[row.state];
  const trend = TREND[row.trend];
  return (
    <article className="glass flex flex-col gap-3 p-5" aria-labelledby={`pulse-${row.dimension}`}>
      <header className="flex items-start justify-between gap-2">
        <h2 id={`pulse-${row.dimension}`} className="font-semibold">{DIMENSION_LABEL[row.dimension as Dimension] ?? row.dimension}</h2>
        <span className={cn("flex items-center gap-1 text-xs font-semibold", meta.tone)}>
          <meta.Icon className="size-4" aria-hidden /> {meta.label}
        </span>
      </header>
      {row.score !== null && (
        <div className="flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={row.score} aria-label="Score">
            <div className={cn("h-full rounded-full transition-all", meta.bar)} style={{ width: `${row.score}%` }} />
          </div>
          <span className="w-8 text-right text-sm font-semibold tabular-nums">{row.score}</span>
        </div>
      )}
      {trend && (
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <trend.Icon className="size-3.5" aria-hidden /> {trend.label} vs last month
        </p>
      )}
      <p className="text-sm">{row.why}</p>
      {row.action && (
        <p className="rounded-xl border border-orange/25 bg-orange/10 px-3 py-2 text-sm">
          <span className="font-semibold text-orange-ink">Next step: </span>{row.action}
        </p>
      )}
      {feedback && (
        <form action={pulseFeedback} className="mt-auto flex items-center gap-2 pt-1 text-xs text-muted-foreground">
          <input type="hidden" name="businessId" value={feedback.businessId} />
          <input type="hidden" name="dimension" value={row.dimension} />
          <input type="hidden" name="computedOn" value={feedback.computedOn} />
          <span>Does this match what you see?</span>
          {(["accurate", "inaccurate"] as const).map((v) => (
            <button key={v} name="verdict" value={v} aria-pressed={feedback.given === v}
              className={cn("rounded-full border px-2 py-0.5 hover:bg-muted", feedback.given === v && "border-growth text-growth")}>
              {v === "accurate" ? "Yes" : "No"}
            </button>
          ))}
        </form>
      )}
    </article>
  );
}
