import { CheckCircle2, CircleSlash } from "lucide-react";

type Check = { rule: string; required: unknown; actual: unknown; pass: boolean };
const LABEL: Record<string, (c: Check) => string> = {
  country: (c) => `Open in ${(c.required as string[]).join(", ")} (you: ${String(c.actual)})`,
  sector: (c) => `For ${(c.required as string[]).join(", ")}`,
  months_with_records: (c) => `${String(c.required)}+ months of records (you: ${String(c.actual)})`,
  active_days_90: (c) => `${String(c.required)}+ active days in 90 (you: ${String(c.actual)})`,
  proof_level: (c) => `Proof level: ${String(c.required).replace(/_/g, " ")} (you: ${String(c.actual).replace(/_/g, " ")})`,
  verified_outcomes: (c) => `${String(c.required)}+ verified results (you: ${String(c.actual)})`,
};

/** B16: requirement-by-requirement, never a score. */
export function Eligibility({ result }: { result: { eligible: boolean; checks: Check[] } }) {
  return (
    <ul className="space-y-1 text-sm" aria-label="Requirements">
      {result.checks.map((c) => (
        <li key={c.rule} className="flex gap-2">
          {c.pass ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-growth" aria-label="Met" /> : <CircleSlash className="mt-0.5 size-4 shrink-0 text-orange-ink" aria-label="Not met" />}
          {LABEL[c.rule]?.(c) ?? c.rule}
        </li>
      ))}
      {!result.checks.length && <li className="text-muted-foreground">No requirements listed.</li>}
    </ul>
  );
}
