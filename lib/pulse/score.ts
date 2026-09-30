import { formatMoney } from "@/lib/money";

export const DIMENSIONS = [
  "sales_momentum", "profitability", "cash_flow", "cost_control", "customer_base",
  "receivables", "stock_health", "record_keeping", "evidence_strength",
] as const;
export type Dimension = (typeof DIMENSIONS)[number];
export type PulseState = "strong" | "steady" | "watch" | "at_risk" | "insufficient_data";
export type PulseTrend = "up" | "flat" | "down" | "unknown";

export type Metrics = {
  sales_30: number; sales_prev_30: number; sales_count_30: number; collected_30: number;
  expenses_30: number; expenses_prev_30: number; receivable_total: number; receivable_over_30: number;
  customers_60: number; repeat_customers_60: number; products_count: number; products_negative: number;
  products_low: number; active_days_30: number; records_30: number; records_captured_30: number;
  records_verified_30: number; tenure_days: number;
};

export type DimensionResult = {
  dimension: Dimension;
  score: number | null;
  state: PulseState;
  trend: PulseTrend;
  why: string;
  action: string | null;
  evidence: Record<string, number | string>;
};

export const DIMENSION_LABEL: Record<Dimension, string> = {
  sales_momentum: "Sales",
  profitability: "Sales minus spending",
  cash_flow: "Money in vs out",
  cost_control: "Costs",
  customer_base: "Returning customers",
  receivables: "Money owed to you",
  stock_health: "Stock",
  record_keeping: "Record keeping",
  evidence_strength: "Proof behind your numbers",
};

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const pct = (n: number) => `${Math.round(n * 100)}%`;

export function stateFor(score: number | null): PulseState {
  if (score === null) return "insufficient_data";
  if (score >= 75) return "strong";
  if (score >= 55) return "steady";
  if (score >= 35) return "watch";
  return "at_risk";
}

type Raw = { score: number | null; why: string; action: string | null; evidence?: Record<string, number | string> };
const none = (why: string, action: string | null = null): Raw => ({ score: null, why, action });

/** Each scorer is pure: same metrics in, same explanation out. */
export const scorers: Record<Dimension, (m: Metrics, cur: string) => Raw> = {
  sales_momentum(m, cur) {
    if (m.sales_30 === 0 && m.sales_prev_30 === 0) return none("No sales recorded in the last 60 days.", "Record today's sales so Foundry can track your momentum.");
    if (m.sales_prev_30 === 0) return { score: 70, why: `${formatMoney(m.sales_30, cur)} in sales this month, and none recorded the month before.`, action: "Keep recording daily to see a real trend next month." };
    const g = (m.sales_30 - m.sales_prev_30) / m.sales_prev_30;
    return {
      score: clamp(60 + g * 100),
      why: `Sales are ${g >= 0 ? "up" : "down"} ${pct(Math.abs(g))}: ${formatMoney(m.sales_30, cur)} in the last 30 days vs ${formatMoney(m.sales_prev_30, cur)} before.`,
      action: g < -0.1 ? "Look at which products or customers dropped off and follow up with regulars." : null,
      evidence: { growth: Number(g.toFixed(3)) },
    };
  },
  profitability(m, cur) {
    if (m.sales_30 === 0) return none("No sales this month to compare with spending.");
    const margin = (m.sales_30 - m.expenses_30) / m.sales_30;
    return {
      score: clamp(50 + margin * 125),
      why: `You kept ${formatMoney(m.sales_30 - m.expenses_30, cur)} of ${formatMoney(m.sales_30, cur)} in sales after spending (${pct(margin)}).`,
      action: margin < 0.1 ? "Check your prices against what stock now costs you, and your biggest expense categories." : null,
      evidence: { margin: Number(margin.toFixed(3)) },
    };
  },
  cash_flow(m, cur) {
    if (m.collected_30 === 0 && m.expenses_30 === 0) return none("No money in or out recorded this month.");
    const ratio = m.expenses_30 === 0 ? 1.6 : m.collected_30 / m.expenses_30;
    return {
      score: clamp(ratio * 60),
      why: `${formatMoney(m.collected_30, cur)} came in and ${formatMoney(m.expenses_30, cur)} went out in the last 30 days.`,
      action: ratio < 1 ? "More is going out than coming in. Collect what customers owe and delay non-essential spending." : null,
      evidence: { ratio: Number(ratio.toFixed(2)) },
    };
  },
  cost_control(m) {
    if (m.expenses_prev_30 === 0 || m.sales_prev_30 === 0) return none("Needs two months of sales and expenses to compare.", "Record expenses as they happen, including small ones.");
    const eg = (m.expenses_30 - m.expenses_prev_30) / m.expenses_prev_30;
    const sg = (m.sales_30 - m.sales_prev_30) / m.sales_prev_30;
    return {
      score: clamp(60 + (sg - eg) * 100),
      why: `Spending ${eg >= 0 ? "rose" : "fell"} ${pct(Math.abs(eg))} while sales ${sg >= 0 ? "rose" : "fell"} ${pct(Math.abs(sg))}.`,
      action: eg > sg + 0.1 ? "Costs are growing faster than sales. Review your top expense categories this week." : null,
      evidence: { expense_growth: Number(eg.toFixed(3)), sales_growth: Number(sg.toFixed(3)) },
    };
  },
  customer_base(m) {
    if (m.customers_60 < 3) return none("Too few named customers to measure loyalty.", "Add the customer's name when you record a sale.");
    const share = m.repeat_customers_60 / m.customers_60;
    return {
      score: clamp(30 + share * 140),
      why: `${m.repeat_customers_60} of ${m.customers_60} named customers bought more than once in the last 60 days.`,
      action: share < 0.3 ? "Reach out to customers who bought once: a thank-you message or a small offer." : null,
      evidence: { repeat_share: Number(share.toFixed(3)) },
    };
  },
  receivables(m, cur) {
    if (m.receivable_total === 0) {
      return m.sales_30 === 0 ? none("No credit sales recorded.") : { score: 95, why: "Nobody owes you money right now.", action: null };
    }
    const ratio = m.receivable_total / Math.max(m.sales_30, 1);
    const overdue = m.receivable_over_30 / m.receivable_total;
    return {
      score: clamp(100 - ratio * 100 - overdue * 30),
      why: `Customers owe you ${formatMoney(m.receivable_total, cur)}${m.receivable_over_30 ? `, ${formatMoney(m.receivable_over_30, cur)} of it for over 30 days` : ""}.`,
      action: overdue > 0.3 || ratio > 0.4 ? "Follow up on the oldest debts first and pause new credit for customers who are behind." : null,
      evidence: { owed_vs_sales: Number(ratio.toFixed(3)), overdue_share: Number(overdue.toFixed(3)) },
    };
  },
  stock_health(m) {
    if (m.products_count === 0) return none("No products tracked yet.", "Record stock you buy so Foundry can warn you before you run out.");
    const bad = m.products_negative + m.products_low;
    return {
      score: clamp(100 - (bad / m.products_count) * 120),
      why: bad === 0 ? `All ${m.products_count} tracked products look fine.` : `${m.products_negative} product(s) show less than zero and ${m.products_low} are running low.`,
      action: m.products_negative > 0 ? "Count those products and record a stock adjustment so your numbers match the shelf." : m.products_low > 0 ? "Restock low items before they run out." : null,
    };
  },
  record_keeping(m) {
    if (m.tenure_days < 7 && m.records_30 < 5) return none("You're just getting started. Keep recording for a week.");
    return {
      score: clamp((m.active_days_30 / 20) * 100),
      why: `You recorded something on ${m.active_days_30} of the last 30 days.`,
      action: m.active_days_30 < 15 ? "Try recording at the end of every trading day. It takes a minute by voice." : null,
    };
  },
  evidence_strength(m) {
    if (m.records_30 < 5) return none("Not enough records this month to judge the proof behind them.");
    const captured = m.records_captured_30 / m.records_30;
    const verified = m.records_verified_30 / m.records_30;
    return {
      score: clamp(30 + captured * 40 + verified * 60),
      why: `${pct(captured)} of this month's records came from a capture you confirmed, and ${pct(verified)} are backed by a document or third party.`,
      action: verified < 0.2 ? "Add receipts or bank/mobile-money statements to strengthen your Passport." : null,
    };
  },
};

export function computePulse(current: Metrics, previous: Metrics | null, currency: string): DimensionResult[] {
  return DIMENSIONS.map((dimension) => {
    const now = scorers[dimension](current, currency);
    const before = previous ? scorers[dimension](previous, currency).score : null;
    let trend: PulseTrend = "unknown";
    if (now.score !== null && before !== null) trend = now.score - before > 5 ? "up" : before - now.score > 5 ? "down" : "flat";
    return {
      dimension,
      score: now.score,
      state: stateFor(now.score),
      trend,
      why: now.why,
      action: now.action,
      evidence: { ...(now.evidence ?? {}), ...(before !== null ? { previous_score: before } : {}) },
    };
  });
}
