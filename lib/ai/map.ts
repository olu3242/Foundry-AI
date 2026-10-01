import { toMinor } from "@/lib/money";
import { fieldsSchemaByKind, type RecordKind } from "@/lib/records/schemas";
import type { ExtractedRecord } from "./extraction-schema";

export type DraftInput = {
  kind: RecordKind;
  fields: Record<string, unknown>;
  confidence: number;
  evidence: { field: string; quote: string }[];
  explanation: string;
};

const undef = <T,>(v: T | null | undefined) => (v === null || v === "" ? undefined : v);

function occurredAt(day: string | null, timezoneNoon = "T12:00:00Z") {
  return day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? `${day}${timezoneNoon}` : undefined;
}

/** Converts model output to confirm_draft payloads, dropping anything that fails validation. */
export function toDrafts(records: ExtractedRecord[], currency: string) {
  const drafts: DraftInput[] = [];
  const rejected: { kind: string; issues: string }[] = [];

  for (const r of records) {
    let fields: Record<string, unknown>;
    switch (r.kind) {
      case "sale": {
        const items = r.items.map((i) => ({
          description: i.description,
          product_name: undef(i.product_name),
          quantity: i.quantity,
          unit_price_minor: toMinor(i.unit_price, currency),
        }));
        const itemsTotal = items.reduce((sum, i) => sum + Math.round(i.quantity * i.unit_price_minor), 0);
        const total = r.total > 0 ? toMinor(r.total, currency) : itemsTotal;
        fields = {
          occurred_at: occurredAt(r.occurred_on),
          customer_name: undef(r.customer_name),
          items,
          total_minor: total,
          amount_paid_minor: r.amount_paid === null ? undefined : toMinor(r.amount_paid, currency),
          payment_method: r.payment_method,
        };
        break;
      }
      case "expense":
        fields = {
          occurred_at: occurredAt(r.occurred_on),
          category: r.category,
          description: undef(r.description),
          amount_minor: toMinor(r.amount, currency),
          payment_method: r.payment_method,
          supplier: undef(r.supplier),
        };
        break;
      case "stock_movement":
        fields = {
          occurred_at: occurredAt(r.occurred_on),
          product_name: r.product_name,
          quantity_delta: r.quantity_delta,
          reason: r.reason,
          unit_cost_minor: r.unit_cost === null ? undefined : toMinor(r.unit_cost, currency),
        };
        break;
      case "customer":
        fields = { name: r.name, phone: undef(r.phone) };
        break;
    }
    const parsed = fieldsSchemaByKind[r.kind].safeParse(fields);
    if (!parsed.success) {
      rejected.push({ kind: r.kind, issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") });
      continue;
    }
    drafts.push({
      kind: r.kind,
      fields: JSON.parse(JSON.stringify(parsed.data)) as Record<string, unknown>,
      confidence: Math.min(1, Math.max(0, Number(r.confidence.toFixed(2)))),
      evidence: r.evidence.slice(0, 12),
      explanation: r.explanation.slice(0, 300),
    });
  }
  return { drafts, rejected };
}
