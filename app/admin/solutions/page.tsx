import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deprecateVersion } from "../actions";

export const metadata: Metadata = { title: "Solution effectiveness" };

const pct = (n: number | null) => (n === null ? "—" : `${Math.round(n * 100)}%`);

export default async function SolutionsAdminPage() {
  const supabase = await createClient();
  const { data: rows } = await supabase.rpc("solution_effectiveness", {});
  return (
    <>
      <PageHeader eyebrow="Admin" title="Is each solution working?"
        description="Per version: started → completed → improved → verified. Rates use completed plans as the base; fewer than 5 completions is flagged as too small to judge." />
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
