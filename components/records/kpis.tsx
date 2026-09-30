import { formatMoney } from "@/lib/money";

export type Summary = {
  sales_count: number; sales_minor: number; collected_minor: number; receivable_minor: number;
  expenses_minor: number; net_minor: number; customers_served: number;
};

export function Kpis({ summary, currency, period }: { summary: Summary; currency: string; period: string }) {
  const items = [
    { label: "Sales", value: formatMoney(summary.sales_minor, currency), sub: `${summary.sales_count} sales` },
    { label: "Money in", value: formatMoney(summary.collected_minor, currency), sub: "collected" },
    { label: "Owed to you", value: formatMoney(summary.receivable_minor, currency), sub: "on credit", tone: summary.receivable_minor > 0 ? "text-gold-ink" : "" },
    { label: "Expenses", value: formatMoney(summary.expenses_minor, currency), sub: "spent" },
    { label: "Sales minus expenses", value: formatMoney(summary.net_minor, currency), sub: period, tone: summary.net_minor < 0 ? "text-orange-ink" : "text-growth" },
  ];
  return (
    <dl className="grid grid-cols-2 gap-3 md:grid-cols-5">
      {items.map((i) => (
        <div key={i.label} className="glass p-4">
          <dt className="text-xs text-muted-foreground">{i.label}</dt>
          <dd className={`mt-1 text-lg font-semibold tabular-nums ${i.tone ?? ""}`}>{i.value}</dd>
          <dd className="text-xs text-muted-foreground">{i.sub}</dd>
        </div>
      ))}
    </dl>
  );
}
