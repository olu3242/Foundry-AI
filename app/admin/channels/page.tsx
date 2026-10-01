import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChannelCostForm } from "@/components/admin/channel-cost-form";

export const metadata: Metadata = { title: "Channels" };

type Ch = { channel: string; acquired: number; activation_rate: number | null; retention_30_60: number | null; retention_sample: number; verified_outcome_rate: number | null;
  revenue_usd: number; ai_cost_usd: number; allocated_shared_cost_usd: number | null; contribution_usd: number; cac_usd: number | null; payback_months: number | null; notes: Record<string, string> };

const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);

export default async function ChannelsPage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("channel_economics", { p_months: 6 });
  const e = data as unknown as { channels: Ch[]; shared_costs_usd: number };
  return (
    <>
      <PageHeader eyebrow="Admin" title="Channel economics" description="Source → acquisition → activation → retention → outcome → revenue and cost, last 6 months. CAC and payback only where acquisition cost is evidenced." />
      <Card aria-label="Record acquisition cost" className="mb-6"><CardHeader><CardTitle>Acquisition cost evidence</CardTitle></CardHeader><ChannelCostForm /></Card>
      <Card aria-label="Channels">
        <CardHeader><CardTitle>By channel</CardTitle><CardDescription>Shared costs (${e.shared_costs_usd}) are allocated by active businesses and labelled as allocated.</CardDescription></CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm"><thead><tr className="text-left text-xs text-muted-foreground">
            <th>Channel</th><th>Acquired</th><th>Activated</th><th>Retained 30–60d</th><th>Verified outcome</th><th>Revenue</th><th>AI</th><th>Allocated</th><th>Contribution</th><th>CAC</th><th>Payback</th></tr></thead>
            <tbody>{e.channels.map((c) => (
              <tr key={c.channel} data-testid={`channel-${c.channel}`} className="align-top">
                <td>{c.channel.replace("_", " ")}</td><td>{c.acquired}</td><td>{pct(c.activation_rate)}</td><td>{pct(c.retention_30_60)} <span className="text-xs text-muted-foreground">(n={c.retention_sample})</span></td>
                <td>{pct(c.verified_outcome_rate)}</td><td>${c.revenue_usd}</td><td>${c.ai_cost_usd}</td><td>${c.allocated_shared_cost_usd ?? 0}</td><td>${c.contribution_usd}</td>
                <td data-testid={`cac-${c.channel}`}>{c.cac_usd == null ? "unknown" : `$${c.cac_usd}`}</td><td>{c.payback_months == null ? "—" : `${c.payback_months} mo`}</td>
              </tr>))}</tbody></table>
        </div>
        <ul className="mt-3 space-y-1 text-xs text-muted-foreground">{e.channels.map((c) => Object.values(c.notes).filter((n) => !n.startsWith("Shared")).map((n) => <li key={c.channel + n}>{c.channel}: {n}</li>))}</ul>
      </Card>
    </>
  );
}
