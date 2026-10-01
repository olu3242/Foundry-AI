import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/utils";
import { RefundForm } from "./refund-form";

export const metadata: Metadata = { title: "Payments" };

type R = { by_status: Record<string, number>; by_channel: Record<string, number>; checks: Record<string, number>;
  collected: { currency: string; paid_minor: number; refunded_minor: number; n: number }[];
  recent: { id: string; business: string; reference: string; transaction_id: string | null; amount_minor: number; currency: string; status: string;
    channel: string | null; reason: string | null; refunded_minor: number; revenue_event_id: string | null; at: string }[] };

const REFUNDABLE = ["succeeded", "partially_refunded", "duplicate", "mismatch"];

export default async function PaymentsPage() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("payment_reconciliation", { p_days: 30 });
  const r = data as unknown as R;
  const failing = Object.entries(r.checks).filter(([, v]) => v > 0);
  return (
    <>
      <PageHeader eyebrow="Admin" title="Payments and reconciliation"
        description="Online payments mirrored from the provider: request → checkout → transaction → settlement → refund. Mismatches and double payments are held for a person." />
      <Card className="mb-6" aria-label="Reconciliation">
        <CardHeader><CardTitle className="flex items-center gap-2">Reconciliation <Badge tone={failing.length ? "attention" : "brand"} data-testid="recon-status">{failing.length ? "Needs attention" : "Reconciled"}</Badge></CardTitle>
          <CardDescription>{Object.entries(r.checks).map(([k, v]) => `${k.replaceAll("_", " ")}: ${v}`).join(" · ")}</CardDescription></CardHeader>
        <p className="text-sm">Collected (30 days): {r.collected.map((c) => `${formatMoney(c.paid_minor, c.currency)} in ${c.n} payment(s), ${formatMoney(c.refunded_minor, c.currency)} refunded`).join(" · ") || "nothing yet"}
          <span className="block text-xs text-muted-foreground">By channel: {Object.entries(r.by_channel).map(([k, v]) => `${k.replaceAll("_", " ")} ${v}`).join(" · ") || "—"}</span></p>
      </Card>
      <Card aria-label="Recent payments"><CardHeader><CardTitle>Recent</CardTitle></CardHeader>
        <ul className="divide-y text-sm">{r.recent.map((p) => (
          <li key={p.id} className="py-2" aria-label={`Payment ${p.reference}`}>
            <span className="flex flex-wrap items-center gap-2">{p.business} · {formatMoney(p.amount_minor, p.currency)} · <Badge tone={p.status === "succeeded" ? "brand" : ["mismatch", "duplicate", "disputed", "failed"].includes(p.status) ? "attention" : "neutral"} data-testid="payment-status">{p.status}</Badge>
              {p.channel && <span className="text-xs">{p.channel.replaceAll("_", " ")}</span>}<span className="text-xs text-muted-foreground">{formatDate(p.at)}</span></span>
            <span className="block font-mono text-xs text-muted-foreground">{p.reference}{p.transaction_id ? ` · provider ${p.transaction_id}` : ""}{p.refunded_minor ? ` · refunded ${formatMoney(p.refunded_minor, p.currency)}` : ""}</span>
            {p.reason && <span className="block text-xs text-muted-foreground">{p.reason}</span>}
            {REFUNDABLE.includes(p.status) && p.transaction_id && <RefundForm id={p.id} max={p.amount_minor - p.refunded_minor} />}
          </li>))}
          {!r.recent.length && <li className="py-2 text-muted-foreground">None yet.</li>}</ul>
      </Card>
    </>
  );
}
