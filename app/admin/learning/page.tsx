import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Learning" };

type Row = Record<string, string | number | null>;
const pct = (v: unknown) => (typeof v === "number" ? `${Math.round(v * 100)}%` : "—");

function Table({ title, rows, cols, label }: { title: string; rows: Row[]; cols: [string, string, boolean?][]; label: string }) {
  return (
    <section className="glass mb-6 overflow-x-auto p-5" aria-label={title}>
      <h2 className="mb-3 font-semibold">{title}</h2>
      {!rows.length ? <p className="text-sm text-muted-foreground">No data yet.</p> : (
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground"><tr>{cols.map(([, h]) => <th key={h} className="p-2 font-medium">{h}</th>)}</tr></thead>
          <tbody className="divide-y">{rows.map((r, i) => (
            <tr key={i} aria-label={String(r[label])}>{cols.map(([k, , isPct]) => <td key={k} className="p-2 tabular-nums">{isPct ? pct(r[k]) : (r[k] ?? "—")}</td>)}</tr>
          ))}</tbody>
        </table>
      )}
    </section>
  );
}

/** B18: are recommendations, extraction and Pulse getting better? Association, not causation. */
export default async function LearningPage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("learning_overview");
  const o = (data ?? {}) as { recommendations: Row[]; extraction: Row[]; pulse_calibration: Row[]; drift: Row[] };
  return (
    <>
      <PageHeader eyebrow="Admin" title="Is Foundry learning?"
        description="Recommendations followed to verified outcomes, extraction edits at confirmation, and Pulse feedback. Rates show association with results, not proof of cause." />
      {!!o.drift?.length && (
        <p className="mb-4 flex flex-wrap gap-2" aria-label="Drift">{o.drift.map((d, i) => <Badge key={i} tone="attention">Drift: {String(d.scope)} · {String(d.subject)}</Badge>)}</p>
      )}
      <Table title="Recommendations by generator" label="generator" rows={o.recommendations ?? []} cols={[
        ["generator", "Generator"], ["shown", "Shown"], ["accepted", "Accepted"], ["rejected", "Rejected"], ["ignored", "Ignored"],
        ["acceptance_rate", "Acceptance", true], ["completion_rate", "Completed", true], ["improved_rate", "Improved", true], ["verified_rate", "Verified", true], ["median_decision_hours", "Hours to decide"],
      ]} />
      <Table title="Capture extraction" label="model" rows={o.extraction ?? []} cols={[
        ["model", "Model"], ["drafts", "Drafts"], ["confirmed", "Confirmed"], ["confirmed_unedited", "Unedited"], ["edited", "Edited"], ["rejected", "Rejected"], ["edit_rate", "Edit rate", true], ["reject_rate", "Reject rate", true],
      ]} />
      <Table title="Pulse calibration (owner feedback)" label="dimension" rows={o.pulse_calibration ?? []} cols={[
        ["dimension", "Signal"], ["feedback", "Feedback"], ["accurate", "Said accurate"], ["accuracy", "Accuracy", true],
      ]} />
    </>
  );
}
