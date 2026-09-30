import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deprecateVersion, reviewProvider, reviewSolution } from "../actions";
import { Select } from "@/components/ui/input";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Solution effectiveness" };

const pct = (n: number | null) => (n === null ? "—" : `${Math.round(n * 100)}%`);

export default async function SolutionsAdminPage() {
  const supabase = await createClient();
  const [{ data: rows }, { data: pendingProviders }, { data: submitted }] = await Promise.all([
    supabase.rpc("solution_effectiveness", {}),
    supabase.from("providers").select("id, name, kind, contact, description").eq("status", "pending"),
    supabase.from("solutions").select("id, name, summary, delivery, pricing_model, price_minor, currency, providers(name)").eq("status", "submitted"),
  ]);
  return (
    <>
      <PageHeader eyebrow="Admin" title="Is each solution working?"
        description="Per version: started → completed → improved → verified. Rates use completed plans as the base; fewer than 5 completions is flagged as too small to judge." />
      {(!!pendingProviders?.length || !!submitted?.length) && (
        <section className="glass mb-6 space-y-4 p-5" aria-label="Review queue">
          <h2 className="font-semibold">Review queue</h2>
          {pendingProviders?.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-3 text-sm" aria-label={`Provider ${p.name}`}>
              <span className="flex-1"><span className="font-medium">{p.name}</span> · {p.kind} · {p.contact}</span>
              {(["approved", "suspended"] as const).map((st) => (
                <form key={st} action={reviewProvider}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="status" value={st} />
                  <Button size="sm" variant={st === "approved" ? "default" : "ghost"}>{st === "approved" ? "Approve provider" : "Suspend"}</Button></form>
              ))}
            </div>
          ))}
          {submitted?.map((s) => (
            <form key={s.id} action={reviewSolution} className="flex flex-wrap items-center gap-2 text-sm" aria-label={`Solution ${s.name}`}>
              <input type="hidden" name="id" value={s.id} />
              <span className="flex-1"><span className="font-medium">{s.name}</span> by {s.providers?.name} · {s.delivery.replace("_", " ")} · {s.pricing_model}{s.price_minor ? ` ${formatMoney(s.price_minor, s.currency ?? "NGN")}` : ""}</span>
              <Input name="note" aria-label="Review note" placeholder="Note" className="h-8 w-40 text-xs" />
              <Select name="decision" aria-label="Review decision" className="h-8 w-32 text-xs" defaultValue="active"><option value="active">Approve</option><option value="rejected">Reject</option></Select>
              <Button size="sm">Send review</Button>
            </form>
          ))}
        </section>
      )}
      <div className="glass overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground">
            <tr>{["Solution", "Started", "Completed", "Improved", "Verified", "Completion", "Improved rate", "Verified rate", "Median change", "Why not", ""].map((h) => <th key={h} className="p-3 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y">
            {rows?.map((r) => (
              <tr key={r.version_id} aria-label={`${r.solution_name} v${r.version}`}>
                <td className="p-3"><span className="font-medium">{r.solution_name}</span> v{r.version} {r.version_status === "deprecated" && <Badge>deprecated</Badge>} {!r.sample_ok && <Badge tone="opportunity">small sample</Badge>}</td>
                <td className="p-3 tabular-nums">{r.activated}</td><td className="p-3 tabular-nums">{r.completed}</td>
                <td className="p-3 tabular-nums">{r.improved}</td><td className="p-3 tabular-nums">{r.verified}</td>
                <td className="p-3 tabular-nums">{pct(r.completion_rate)}</td><td className="p-3 tabular-nums">{pct(r.improvement_rate)}</td>
                <td className="p-3 tabular-nums">{pct(r.verified_rate)}</td><td className="p-3 tabular-nums">{pct(r.median_change_pct)}</td>
                <td className="p-3 text-xs text-muted-foreground">{Object.entries((r.failure_reasons ?? {}) as Record<string, number>).map(([k, v]) => `${k.replace("_", " ")} ${v}`).join(", ") || "—"}</td>
                <td className="p-3">
                  {r.version_status === "active" && (
                    <form action={deprecateVersion} className="flex gap-1">
                      <input type="hidden" name="versionId" value={r.version_id} />
                      <Input name="reason" aria-label="Deprecation reason" placeholder="Reason" required minLength={3} className="h-8 w-28 text-xs" />
                      <Button size="sm" variant="ghost">Deprecate</Button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
