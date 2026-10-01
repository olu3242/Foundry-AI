export type Report = {
  enrolled: number; active_30d: number; invited: number; accepted: number; conversion: number | null;
  by_channel: Record<string, string>; activation: Record<string, number>; pulse_states: Record<string, number>;
  outcomes: { observed: number; improved: number; verified_improved: number }; consent: { active: number; withdrawn: number };
};

/** B15 sponsor report: aggregates only; groups under 5 are shown as "<5". */
export function ProgramReport({ report, programId }: { report: Report; programId: string }) {
  const tiles = [
    ["Enrolled", report.enrolled], ["Active (30 days)", report.active_30d], ["Invited", report.invited],
    ["Joined from invites", report.accepted], ["Invite conversion", report.conversion === null ? "—" : `${Math.round(report.conversion * 100)}%`],
    ["Results measured", report.outcomes.observed], ["Improved", report.outcomes.improved], ["Improved and verified", report.outcomes.verified_improved],
    ["Consent active", report.consent.active], ["Consent withdrawn", report.consent.withdrawn],
  ] as const;
  return (
    <div className="space-y-4" aria-label="Program report">
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {tiles.map(([k, v]) => <div key={k} className="rounded-xl border p-3"><dt className="text-xs text-muted-foreground">{k}</dt><dd className="text-lg font-semibold tabular-nums">{v}</dd></div>)}
      </dl>
      <p className="text-xs text-muted-foreground">
        Channels: {Object.entries(report.by_channel).map(([k, v]) => `${k.replace("_", " ")} ${v}`).join(" · ") || "—"} ·
        Activation: {report.activation.first_record} recording, {report.activation.first_plan} running plans, {report.activation.first_verified_outcome} with a verified result
      </p>
      <a href={`/programs/${programId}/report.csv`} className="text-sm font-medium text-growth hover:underline">Download report (CSV, aggregates only)</a>
    </div>
  );
}
