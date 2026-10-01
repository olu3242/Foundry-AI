import { formatMoney } from "@/lib/money";

/** Outcome metrics (keys of B7 pulse_metrics). Keep in sync with private.metric_direction. */
export const METRICS = {
  sales_30: { label: "Sales (30 days)", direction: "up", money: true },
  collected_30: { label: "Money collected (30 days)", direction: "up", money: true },
  expenses_30: { label: "Spending (30 days)", direction: "down", money: true },
  receivable_total: { label: "Owed to you", direction: "down", money: true },
  receivable_over_30: { label: "Owed for over 30 days", direction: "down", money: true },
  active_days_30: { label: "Days with records (30 days)", direction: "up", money: false },
  repeat_customers_60: { label: "Returning customers (60 days)", direction: "up", money: false },
  records_verified_30: { label: "Backed records (30 days)", direction: "up", money: false },
} as const;
export type MetricKey = keyof typeof METRICS;

/** Which metric a Pulse dimension's plan should move. */
export const DIMENSION_METRIC: Record<string, MetricKey> = {
  sales_momentum: "sales_30",
  profitability: "expenses_30",
  cash_flow: "collected_30",
  cost_control: "expenses_30",
  customer_base: "repeat_customers_60",
  receivables: "receivable_over_30",
  stock_health: "records_verified_30",
  record_keeping: "active_days_30",
  evidence_strength: "records_verified_30",
};

/** B31: vertical pack metrics are "pack:<pack>:<metric>" ratios configured in the database. */
export const isPackMetric = (metric: string) => metric.startsWith("pack:");

export function metricLabel(metric: string) {
  return METRICS[metric as MetricKey]?.label ?? (isPackMetric(metric) ? metric.split(":")[2]!.replaceAll("_", " ") : metric);
}

export function formatMetric(metric: string, value: number, currency: string) {
  if (isPackMetric(metric)) return `${Math.round(value * 1000) / 10}%`;
  const m = METRICS[metric as MetricKey];
  return m?.money ? formatMoney(Math.round(value), currency) : String(Math.round(value * 10) / 10);
}

export function isImprovement(metric: string, delta: number, direction?: "up" | "down" | string) {
  const d = METRICS[metric as MetricKey]?.direction ?? direction;
  return d ? (d === "up" ? delta > 0 : delta < 0) : false;
}
