import { z } from "zod";

export const PAYMENT_METHODS = ["cash", "transfer", "mobile_money", "card", "credit", "other"] as const;
export const STOCK_REASONS = ["purchase", "sale", "adjustment", "waste", "return"] as const;
export const RECORD_KINDS = ["sale", "expense", "stock_movement", "customer"] as const;
export type RecordKind = (typeof RECORD_KINDS)[number];

export const PAYMENT_LABEL: Record<(typeof PAYMENT_METHODS)[number], string> = {
  cash: "Cash",
  transfer: "Bank transfer",
  mobile_money: "Mobile money",
  card: "Card",
  credit: "On credit",
  other: "Other",
};

const minor = z.number().int().nonnegative();
const occurredAt = z.iso.datetime({ offset: true }).optional();

export const saleItemSchema = z.object({
  description: z.string().trim().min(1).max(200),
  product_name: z.string().trim().max(120).optional(),
  quantity: z.number().positive(),
  unit_price_minor: minor,
});

/** Shapes accepted by public.confirm_draft (amounts in minor units). */
export const saleFieldsSchema = z
  .object({
    occurred_at: occurredAt,
    customer_name: z.string().trim().max(120).optional(),
    items: z.array(saleItemSchema).max(50).default([]),
    total_minor: minor,
    amount_paid_minor: minor.optional(),
    payment_method: z.enum(PAYMENT_METHODS),
    notes: z.string().max(1000).optional(),
  })
  .refine((s) => s.amount_paid_minor === undefined || s.amount_paid_minor <= s.total_minor, {
    message: "Paid can't be more than the total",
    path: ["amount_paid_minor"],
  });

export const expenseFieldsSchema = z.object({
  occurred_at: occurredAt,
  category: z.string().trim().min(1).max(60),
  description: z.string().trim().max(300).optional(),
  amount_minor: minor,
  payment_method: z.enum(PAYMENT_METHODS),
  supplier: z.string().trim().max(120).optional(),
});

export const stockFieldsSchema = z.object({
  occurred_at: occurredAt,
  product_name: z.string().trim().min(1).max(120),
  quantity_delta: z.number().refine((n) => n !== 0, "Quantity can't be zero"),
  reason: z.enum(STOCK_REASONS),
  unit_cost_minor: minor.optional(),
  notes: z.string().max(500).optional(),
});

export const customerFieldsSchema = z.object({
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(32).optional(),
  notes: z.string().max(1000).optional(),
});

export const fieldsSchemaByKind = {
  sale: saleFieldsSchema,
  expense: expenseFieldsSchema,
  stock_movement: stockFieldsSchema,
  customer: customerFieldsSchema,
} as const;

export type SaleFields = z.infer<typeof saleFieldsSchema>;
export type ExpenseFields = z.infer<typeof expenseFieldsSchema>;
export type StockFields = z.infer<typeof stockFieldsSchema>;
export type CustomerFields = z.infer<typeof customerFieldsSchema>;

export const EXPENSE_CATEGORIES = [
  "Stock / inventory",
  "Rent",
  "Transport",
  "Salaries & wages",
  "Utilities",
  "Airtime & data",
  "Repairs",
  "Fees & levies",
  "Marketing",
  "Other",
] as const;
