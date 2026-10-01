import type { Metadata } from "next";
import { requireBusiness } from "@/lib/auth/guards";
import { PageHeader } from "@/components/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Decisions" };

type Option = { key: string; title: string; score: number; expected_value: { p_improve: number | null; completed?: number; verified_improved?: number };
  risk: { policy?: string; tried_before_without_improvement?: boolean; effort_days?: number } };

export default async function DecisionsPage({ params }: { params: Promise<{ bid: string }> }) {
  const { bid } = await params;
  const { supabase } = await requireBusiness(bid);
  const { data } = await supabase.from("decisions").select("*").eq("business_id", bid).order("created_at", { ascending: false }).limit(20);
  const replays = await Promise.all((data ?? []).map(async (d) => ((await supabase.rpc("explain_decision", { p_id: d.id })).data as { replay?: { matches: boolean } } | null)?.replay?.matches));
  return (
    <>
      <PageHeader eyebrow="Decisions" title="How Foundry weighed your options"
        description="For each suggestion: what triggered it, the options, the evidence, the risks, who decided and what happened. Chances come from verified results across Foundry — a guide, not a promise." />
      <div className="space-y-4">
        {data?.map((d, i) => {
          const signal = d.signal as { state?: string; why?: string };
          const result = d.result as { improved?: boolean } | null;
          return (
            <Card key={d.id} aria-label={`Decision ${d.topic.replaceAll("_", " ")}`}>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2">{d.topic.replaceAll("_", " ")} <Badge tone="neutral">{d.status}</Badge>
                  {result && <Badge tone={result.improved ? "brand" : "attention"}>{result.improved ? "improved" : "no improvement"}</Badge>}</CardTitle>
                <CardDescription>Signal: {signal.state?.replace("_", " ")}{signal.why ? ` — ${signal.why}` : ""} · {formatDate(d.created_at)}</CardDescription>
              </CardHeader>
              <table className="w-full text-sm"><thead><tr className="text-left text-xs text-muted-foreground"><th>Option</th><th>Chance it helps</th><th>Evidence</th><th>Risk</th><th /></tr></thead>
                <tbody>{(d.options as unknown as Option[]).map((o) => (
                  <tr key={o.key} data-testid={`option-${o.key}`}>
                    <td>{o.title}</td>
                    <td>{o.expected_value.p_improve == null ? "—" : `${Math.round(o.expected_value.p_improve * 100)}%`}</td>
                    <td className="text-xs">{o.expected_value.completed != null ? `${o.expected_value.verified_improved}/${o.expected_value.completed} verified` : "—"}</td>
                    <td className="text-xs">{[o.risk.policy === "deny" ? "not allowed by policy" : null, o.risk.tried_before_without_improvement ? "didn't help you before" : null,
                      o.risk.effort_days ? `${o.risk.effort_days} days` : null].filter(Boolean).join(" · ") || "—"}</td>
                    <td>{o.key === d.recommended && <Badge tone="insight">recommended</Badge>} {o.key === d.chosen && <Badge tone="trust">chosen</Badge>}</td>
                  </tr>))}</tbody></table>
              <p className="mt-2 text-xs text-muted-foreground">Decided by: {d.decided_by ?? "—"} · method {d.method_version} · {replays[i] ? "reproducible ✓" : "not reproducible"}</p>
            </Card>
          );
        })}
        {!data?.length && <p className="glass p-6 text-sm text-muted-foreground">No decisions yet. They appear with Foundry&apos;s suggestions.</p>}
      </div>
    </>
  );
}
