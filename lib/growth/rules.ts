import { formatMoney } from "@/lib/money";
import { DIMENSION_LABEL, type Dimension } from "@/lib/pulse/score";
import type { ActionType } from "@/lib/autonomy/policy";

export type PulseInput = { dimension: string; state: string; why: string; action: string | null };
export type Debtor = { customer_id: string; name: string; phone: string | null; owed_minor: number; oldest_days: number };
export type StockIssue = { product_id: string; name: string; qty: number; reorder_level: number | null };

export type ActionDraft = {
  action_type: ActionType;
  title: string;
  body: string;
  payload: Record<string, unknown>;
  dedupe_key: string;
  source: string;
};

/** Deterministic, explainable proposals. Every draft says where it came from (source). */
export function growthActions(input: { businessName: string; currency: string; pulse: PulseInput[]; debtors: Debtor[]; stock: StockIssue[] }) {
  const out: ActionDraft[] = [];

  for (const p of input.pulse) {
    if ((p.state === "at_risk" || p.state === "watch") && p.action) {
      out.push({
        action_type: "growth.recommend",
        title: `${DIMENSION_LABEL[p.dimension as Dimension] ?? p.dimension}: ${p.state === "at_risk" ? "needs attention" : "worth watching"}`,
        body: `${p.why} ${p.action}`,
        payload: { dimension: p.dimension },
        dedupe_key: `pulse:${p.dimension}`,
        source: "pulse",
      });
    }
  }

  for (const d of input.debtors.filter((d) => d.owed_minor > 0 && d.oldest_days >= 7).sort((a, b) => b.owed_minor - a.owed_minor).slice(0, 10)) {
    const amount = formatMoney(d.owed_minor, input.currency);
    const message = `Hello ${d.name}, this is ${input.businessName}. A friendly reminder that ${amount} is still outstanding on your account. Thank you for your business!`;
    out.push({
      action_type: "customer.reminder",
      title: `Remind ${d.name} about ${amount}`,
      body: `Owed for ${d.oldest_days} days.`,
      payload: { customer_id: d.customer_id, phone: d.phone, message },
      dedupe_key: `debtor:${d.customer_id}`,
      source: "receivables",
    });
  }

  for (const s of input.stock) {
    const negative = s.qty < 0;
    out.push({
      action_type: "stock.alert",
      title: negative ? `Check your count of ${s.name}` : `${s.name} is running low`,
      body: negative
        ? `Records show ${s.qty} in stock, which can't be right. Count it and record an adjustment.`
        : `${s.qty} left (you asked to be told at ${s.reorder_level}).`,
      payload: { product_id: s.product_id, qty: s.qty },
      dedupe_key: `stock:${s.product_id}`,
      source: "stock",
    });
  }
  return out;
}

export function whatsappLink(phone: string | null, message: string) {
  const digits = phone?.replace(/\D/g, "") ?? "";
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
