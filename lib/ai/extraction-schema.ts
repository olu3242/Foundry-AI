import { z } from "zod";
import { PAYMENT_METHODS, STOCK_REASONS } from "@/lib/records/schemas";

/**
 * What the model returns. Amounts are in MAJOR units (what people say: "45,000"),
 * converted to minor units in code. No numeric constraints here: structured outputs
 * guarantee shape; business rules are enforced afterwards by the record schemas.
 */
const evidence = z
  .array(z.object({ field: z.string(), quote: z.string() }))
  .describe("Exact words from the input that support each extracted field");

const common = {
  confidence: z.number().describe("0 to 1: how sure you are this record is right and complete"),
  evidence,
  explanation: z.string().describe("One short plain-language sentence the owner will read"),
  occurred_on: z.string().nullable().describe("YYYY-MM-DD if the input names a date, else null"),
};

export const extractionSchema = z.object({
  records: z.array(
    z.union([
      z.object({
        kind: z.literal("sale"),
        ...common,
        customer_name: z.string().nullable(),
        items: z.array(
          z.object({
            description: z.string(),
            product_name: z.string().nullable().describe("Normalised product name, matching a known product if one fits"),
            quantity: z.number(),
            unit_price: z.number(),
          }),
        ),
        total: z.number(),
        amount_paid: z.number().nullable().describe("Only if part-paid or on credit"),
        payment_method: z.enum(PAYMENT_METHODS),
      }),
      z.object({
        kind: z.literal("expense"),
        ...common,
        category: z.string(),
        description: z.string().nullable(),
        amount: z.number(),
        payment_method: z.enum(PAYMENT_METHODS),
        supplier: z.string().nullable(),
      }),
      z.object({
        kind: z.literal("stock_movement"),
        ...common,
        product_name: z.string(),
        quantity_delta: z.number().describe("Positive for stock in, negative for stock out"),
        reason: z.enum(STOCK_REASONS),
        unit_cost: z.number().nullable(),
      }),
      z.object({
        kind: z.literal("customer"),
        ...common,
        name: z.string(),
        phone: z.string().nullable(),
      }),
    ]),
  ),
  note_for_user: z.string().nullable().describe("Only if something could not be understood"),
});

export type Extraction = z.infer<typeof extractionSchema>;
export type ExtractedRecord = Extraction["records"][number];
