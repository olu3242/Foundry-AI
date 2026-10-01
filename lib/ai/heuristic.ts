import type { Extraction, ExtractedRecord } from "./extraction-schema";

/**
 * Deterministic stand-in for local development and E2E tests when no AI key is set.
 * Understands a few common phrasings only; never used in production.
 */
const num = (s: string) => {
  const m = s.replace(/,/g, "").match(/^(\d+(?:\.\d+)?)(k)?$/i);
  return m ? Number(m[1]) * (m[2] ? 1000 : 1) : NaN;
};
const AMOUNT = String.raw`(\d[\d,]*(?:\.\d+)?k?)`;
const method = (s: string): "cash" | "transfer" | "mobile_money" | "credit" =>
  /credit|owe|later/i.test(s) ? "credit" : /momo|mobile|m-?pesa|opay/i.test(s) ? "mobile_money" : /transfer|bank/i.test(s) ? "transfer" : "cash";

export function heuristicExtract(text: string): Extraction {
  const records: ExtractedRecord[] = [];
  for (const raw of text.split(/[.;\n]| and (?=sold|paid|bought)/i)) {
    const part = raw.trim();
    if (!part) continue;
    const quote = [{ field: "text", quote: part }];
    const sale = part.match(new RegExp(String.raw`sold\s+(\d+)\s+(.+?)\s+(?:at|@|for)\s+${AMOUNT}(\s+each)?(?:.*?\bto\s+([A-Z][\w' ]+?))?(?:,|$|\s+(?:cash|on|by|via|momo|transfer))`, "i"));
    if (sale) {
      const qty = Number(sale[1]);
      const amount = num(sale[3]!);
      const unit = sale[4] ? amount : amount / qty;
      records.push({
        kind: "sale", confidence: 0.6, evidence: quote, explanation: "Read by the offline rule parser.", occurred_on: null,
        customer_name: sale[5]?.trim() ?? null,
        items: [{ description: sale[2]!, product_name: sale[2]!, quantity: qty, unit_price: unit }],
        total: unit * qty, amount_paid: null, payment_method: method(part),
      });
      continue;
    }
    const expense = part.match(new RegExp(String.raw`(?:paid|spent)\s+${AMOUNT}\s+(?:for|on)\s+(.+)`, "i"));
    if (expense) {
      records.push({
        kind: "expense", confidence: 0.6, evidence: quote, explanation: "Read by the offline rule parser.", occurred_on: null,
        category: expense[2]!.trim(), description: expense[2]!.trim(), amount: num(expense[1]!), payment_method: method(part), supplier: null,
      });
    }
  }
  return { records, note_for_user: records.length ? null : "Couldn't find a sale or expense in that." };
}
