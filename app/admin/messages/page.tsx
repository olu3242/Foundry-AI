import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Messages" };

type O = { by_status: Record<string, number>; suppressed: Record<string, number>; consents: Record<string, number>;
  by_channel: { channel: string; n: number; delivered: number; failed: number }[];
  recent: { id: string; business: string; channel: string | null; status: string; reason: string | null; error: string | null; provider: string | null; at: string }[] };

const kv = (o: Record<string, number>) => Object.entries(o).map(([k, v]) => `${k.replaceAll("_", " ")}: ${v}`).join(" · ") || "None";

export default async function MessagesPage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("messaging_overview", { p_days: 30 });
  const o = data as unknown as O;
  return (
    <>
      <PageHeader eyebrow="Admin" title="Outbound messages" description="EVENT → POLICY → MESSAGE → DELIVERY → RECEIPT. Suppressed messages keep their reason; nothing is sent without consent." />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card aria-label="By status"><CardHeader><CardTitle>Last 30 days</CardTitle><CardDescription data-testid="msg-status">{kv(o.by_status)}</CardDescription></CardHeader></Card>
        <Card aria-label="Suppressed"><CardHeader><CardTitle>Suppressed</CardTitle><CardDescription>{kv(o.suppressed)}</CardDescription></CardHeader></Card>
        <Card aria-label="Consents"><CardHeader><CardTitle>Consents</CardTitle><CardDescription>{kv(o.consents)}</CardDescription></CardHeader></Card>
      </div>
      <Card className="mb-6"><CardHeader><CardTitle>By channel</CardTitle></CardHeader>
        <table className="w-full text-sm"><thead><tr className="text-left text-xs text-muted-foreground"><th>Channel</th><th>Sent</th><th>Delivered</th><th>Failed</th></tr></thead>
          <tbody>{o.by_channel.map((c) => <tr key={c.channel}><td>{c.channel}</td><td>{c.n}</td><td>{c.delivered}</td><td>{c.failed}</td></tr>)}</tbody></table>
      </Card>
      <Card aria-label="Recent messages"><CardHeader><CardTitle>Recent</CardTitle></CardHeader>
        <ul className="divide-y text-sm">{o.recent.map((m) => (
          <li key={m.id} className="py-2">{m.business} · {m.channel ?? "—"} · <b>{m.status}</b>{m.reason ? ` (${m.reason.replaceAll("_", " ")})` : ""} · {formatDate(m.at)}
            {m.error && <span className="block text-xs text-muted-foreground">{m.error}</span>}</li>))}
          {!o.recent.length && <li className="py-2 text-muted-foreground">None yet.</li>}</ul>
      </Card>
    </>
  );
}
