import Link from "next/link";
import { STATE_META } from "@/components/pulse/pulse-card";
import type { PortfolioRow } from "@/lib/programs/portfolio";
import type { PulseState } from "@/lib/pulse/score";
import { formatDate } from "@/lib/utils";

const ORDER: PulseState[] = ["at_risk", "watch", "steady", "strong"];

function States({ states }: { states: Partial<Record<PulseState, number>> }) {
  const shown = ORDER.filter((s) => states[s]);
  if (!shown.length) return <span className="text-xs text-muted-foreground">No Pulse yet</span>;
  return (
    <span className="flex flex-wrap gap-2">
      {shown.map((s) => {
        const m = STATE_META[s];
        return <span key={s} className={`flex items-center gap-1 text-xs ${m.tone}`}><m.Icon className="size-3.5" aria-hidden />{states[s]} {m.label.toLowerCase()}</span>;
      })}
    </span>
  );
}

export function PortfolioTable({ rows, extra }: { rows: PortfolioRow[]; extra?: (row: PortfolioRow) => React.ReactNode }) {
  if (!rows.length) return <p className="p-6 text-sm text-muted-foreground">No businesses yet.</p>;
  return (
    <ul className="divide-y">
      {rows.map((r) => (
        <li key={r.business_id} className="grid gap-2 p-4 md:grid-cols-[1.2fr_1.5fr_1fr_auto] md:items-center">
          <div>
            <Link href={`/b/${r.business_id}/pulse`} className="font-medium hover:underline">{r.name}</Link>
            <p className="text-xs text-muted-foreground">{[r.sector, r.country_code].filter(Boolean).join(" · ")}</p>
          </div>
          <div className="space-y-1">
            <States states={r.states} />
            {r.statesAtStart && (
              <p className="text-xs text-muted-foreground">
                At joining: {ORDER.filter((s) => r.statesAtStart?.[s]).map((s) => `${r.statesAtStart?.[s]} ${STATE_META[s].label.toLowerCase()}`).join(", ") || "no Pulse"}
              </p>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {r.lastActivity ? `Last record ${formatDate(r.lastActivity)}` : "No records yet"}
            <span className="block">Activation {r.activation}/7</span>
          </p>
          <div>{extra?.(r)}</div>
        </li>
      ))}
    </ul>
  );
}
