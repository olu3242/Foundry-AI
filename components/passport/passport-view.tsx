import { BadgeCheck, Building2, FileCheck2, Landmark, PenLine, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/money";
import { DIMENSION_LABEL, type Dimension } from "@/lib/pulse/score";
import { formatMetric, metricLabel } from "@/lib/interventions/catalog";
import type { PassportFacts, PassportPulse, PassportSection, Provenance } from "@/lib/passport/facts";

export const LADDER: { level: Provenance; label: string; description: string; Icon: typeof PenLine }[] = [
  { level: "self_reported", label: "Self-reported", description: "Recorded by the business", Icon: PenLine },
  { level: "document_backed", label: "Document-backed", description: "Receipt, invoice or statement attached", Icon: FileCheck2 },
  { level: "third_party_verified", label: "Third-party verified", description: "Checked by a business partner", Icon: BadgeCheck },
  { level: "institution_verified", label: "Institution verified", description: "Reviewed by a program or institution", Icon: Landmark },
];

const METHOD_LABEL: Record<string, string> = {
  receipt: "Receipt", invoice: "Invoice", bank_statement: "Bank statement", mobile_money_statement: "Mobile money statement",
  registration_certificate: "Registration certificate", tax_certificate: "Tax certificate", site_visit: "Site visit",
  program_review: "Program review", other: "Other document",
};

const month = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en", { month: "short", timeZone: "UTC" });
const date = (d: string) => new Date(d).toLocaleDateString("en", { dateStyle: "medium" });

export function PassportView({ facts, pulse, sections }: { facts: PassportFacts; pulse: PassportPulse | null; sections: readonly PassportSection[] }) {
  const total = Object.values(facts.provenance_180).reduce((a, b) => a + (b ?? 0), 0);
  const maxSales = Math.max(1, ...facts.monthly_sales.map((m) => m.sales_minor));
  const levelIndex = facts.highest_level ? LADDER.findIndex((l) => l.level === facts.highest_level) : 0;

  return (
    <div className="space-y-6">
      <header className="glass relative overflow-hidden p-6">
        <div className="absolute inset-0 -z-10 bg-aurora opacity-60" aria-hidden />
        <p className="eyebrow">Foundry Passport</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight md:text-3xl">
          <Building2 className="size-6 text-growth" aria-hidden /> {facts.name}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {[facts.sector, facts.country_code].filter(Boolean).join(" · ")} · on Foundry since {date(facts.on_foundry_since)}
        </p>
        <p className="mt-4 rounded-xl border bg-surface/60 px-3 py-2 text-xs text-muted-foreground">
          This is not a credit score. It shows the business&apos;s recorded activity and how each part is backed.
        </p>
      </header>

      {sections.includes("summary") && (
        <section aria-labelledby="pp-summary" className="grid gap-3 sm:grid-cols-3">
          <h2 id="pp-summary" className="sr-only">Summary</h2>
          {[
            { k: "Months with records", v: facts.months_with_records },
            { k: "Active days (last 90)", v: facts.active_days_90 },
            { k: "Records (last 6 months)", v: facts.records_180 },
          ].map((i) => (
            <div key={i.k} className="glass p-4">
              <p className="text-xs text-muted-foreground">{i.k}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{i.v}</p>
            </div>
          ))}
        </section>
      )}

      {sections.includes("track_record") && (
        <section aria-labelledby="pp-track" className="glass p-5">
          <h2 id="pp-track" className="mb-4 font-semibold">Monthly sales recorded</h2>
          {facts.monthly_sales.length ? (
            <ul className="flex h-40 items-end gap-2">
              {facts.monthly_sales.map((m) => (
                <li key={m.month} className="flex flex-1 flex-col items-center gap-2">
                  <span className="text-[10px] tabular-nums text-muted-foreground">{formatMoney(m.sales_minor, facts.currency)}</span>
                  <div className="w-full rounded-t-lg bg-gradient-to-t from-brand to-growth" style={{ height: `${Math.max(4, (m.sales_minor / maxSales) * 100)}%` }} />
                  <span className="text-xs text-muted-foreground">{month(m.month)}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-muted-foreground">No sales recorded in the last six months.</p>}
        </section>
      )}

      {sections.includes("proof") && (
        <section aria-labelledby="pp-proof" className="glass space-y-5 p-5">
          <h2 id="pp-proof" className="font-semibold">How the numbers are backed</h2>
          <ol className="grid gap-2 sm:grid-cols-4" aria-label="Verification ladder">
            {LADDER.map((l, i) => {
              const reached = i <= levelIndex;
              const count = facts.provenance_180[l.level] ?? 0;
              return (
                <li key={l.level} className={`rounded-xl border p-3 ${reached ? "border-growth/40 bg-growth/10" : "opacity-60"}`}>
                  <l.Icon className={`mb-2 size-5 ${reached ? "text-growth" : "text-muted-foreground"}`} aria-hidden />
                  <p className="text-sm font-semibold">{l.label}</p>
                  <p className="text-xs text-muted-foreground">{l.description}</p>
                  {l.level !== "institution_verified" && total > 0 && (
                    <p className="mt-2 text-xs tabular-nums">{Math.round((count / total) * 100)}% of records</p>
                  )}
                  <span className="sr-only">{reached ? "Reached" : "Not reached"}</span>
                </li>
              );
            })}
          </ol>
          {facts.verifications.length > 0 && (
            <ul className="divide-y text-sm">
              {facts.verifications.map((v, i) => (
                <li key={i} className="flex flex-wrap items-center gap-2 py-2">
                  <ShieldCheck className="size-4 text-growth" aria-hidden />
                  <span className="font-medium">{METHOD_LABEL[v.method] ?? v.method}</span>
                  <Badge tone={v.level === "document_backed" ? "neutral" : "trust"}>{LADDER.find((l) => l.level === v.level)?.label}</Badge>
                  {v.period_start && v.period_end && <span className="text-muted-foreground">{date(v.period_start)} – {date(v.period_end)}</span>}
                  <span className="ml-auto text-xs text-muted-foreground">{date(v.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {sections.includes("proof") && facts.verified_outcomes?.length > 0 && (
        <section aria-labelledby="pp-results" className="glass p-5">
          <h2 id="pp-results" className="mb-3 font-semibold">Verified results</h2>
          <ul className="divide-y text-sm">
            {facts.verified_outcomes.map((o, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2 py-2">
                <ShieldCheck className="size-4 text-growth" aria-hidden />
                <span className="font-medium">{o.title}</span>
                <span className="text-muted-foreground">
                  {metricLabel(o.metric)}: {formatMetric(o.metric, o.baseline, facts.currency)} → {formatMetric(o.metric, o.observed, facts.currency)}
                </span>
                <span className="ml-auto text-xs text-muted-foreground">checked by {o.verifier_role === "program_admin" ? "a program" : "a partner"} · {date(o.at)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">Measured from the business&apos;s own records before and after each plan. A change after a plan is not proof the plan caused it.</p>
        </section>
      )}

      {sections.includes("pulse") && pulse && (
        <section aria-labelledby="pp-pulse" className="glass p-5">
          <h2 id="pp-pulse" className="mb-3 font-semibold">Pulse signals</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {pulse.filter((p) => p.state !== "insufficient_data").map((p) => (
              <li key={p.dimension} className="rounded-xl border p-3 text-sm">
                <p className="font-medium">{DIMENSION_LABEL[p.dimension as Dimension] ?? p.dimension} · <span className="capitalize">{p.state.replace("_", " ")}</span></p>
                <p className="text-muted-foreground">{p.why}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
