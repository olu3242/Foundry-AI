import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Partners" };

type Row = Record<string, string | number | null | string[]>;

function Table({ rows, cols }: { rows: Row[]; cols: [string, string][] }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground">None yet.</p>;
  return (
    <table className="w-full text-sm"><thead><tr className="text-left text-xs text-muted-foreground">{cols.map(([, l]) => <th key={l}>{l}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i}>{cols.map(([k]) => <td key={k}>{r[k] == null ? "—" : Array.isArray(r[k]) ? (r[k] as string[]).join(", ") : String(r[k])}</td>)}</tr>)}</tbody></table>
  );
}

export default async function PartnersPage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("partner_performance", { p_days: 90 });
  const p = data as unknown as { note: string; program_partners: Row[]; providers: Row[]; verifiers: Row[] };
  return (
    <>
      <PageHeader eyebrow="Admin" title="Partner performance" description={p.note} />
      <Card aria-label="Providers" className="mb-6"><CardHeader><CardTitle>Solution providers</CardTitle><CardDescription>Last 90 days.</CardDescription></CardHeader>
        <Table rows={p.providers} cols={[["name", "Provider"], ["volume", "Engagements"], ["completion_rate", "Completion"], ["first_update_hours", "First update (h)"],
          ["improved_rate", "Improved"], ["verified_improved", "Verified"], ["disputed", "Disputed"]]} /></Card>
      <Card aria-label="Verifiers" className="mb-6"><CardHeader><CardTitle>Verifiers</CardTitle></CardHeader>
        <Table rows={p.verifiers} cols={[["name", "Verifier"], ["volume", "Attestations"], ["open_requests", "Open"], ["turnaround_hours", "Turnaround (h)"],
          ["evidence_quality", "Not corrected"], ["disputes", "Disputes"], ["disputes_upheld", "Upheld"]]} /></Card>
      <Card aria-label="Program partners"><CardHeader><CardTitle>Program partners</CardTitle></CardHeader>
        <Table rows={p.program_partners} cols={[["name", "Partner"], ["capabilities", "Capabilities"], ["volume", "Businesses"], ["verifications", "Verified"],
          ["verify_turnaround_hours", "Turnaround (h)"], ["completion_rate", "Plan completion"], ["escalation_hours", "Escalation (h)"], ["disputed", "Disputed"]]} /></Card>
    </>
  );
}
