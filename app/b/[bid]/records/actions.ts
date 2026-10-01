"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireBusiness, WRITER_ROLES } from "@/lib/auth/guards";
import { fail, friendlyDbError, type ActionState } from "@/lib/actions";
import { toMinor } from "@/lib/money";
import { fieldsSchemaByKind, PAYMENT_METHODS, RECORD_KINDS, STOCK_REASONS } from "@/lib/records/schemas";
import type { Json } from "@/lib/supabase/database.types";

const num = z.coerce.number().nonnegative();
const opt = z.string().trim().max(200).optional().transform((v) => v || undefined);

const entrySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("sale"), description: z.string().trim().min(1).max(200), quantity: z.coerce.number().positive().default(1),
    unit_price: num, payment_method: z.enum(PAYMENT_METHODS), amount_paid: num.optional(), customer_name: opt, occurred_on: opt }),
  z.object({ kind: z.literal("expense"), category: z.string().trim().min(1).max(60), amount: num, payment_method: z.enum(PAYMENT_METHODS),
    supplier: opt, description: opt, occurred_on: opt }),
  z.object({ kind: z.literal("stock_movement"), product_name: z.string().trim().min(1).max(120), quantity: z.coerce.number().positive(),
    direction: z.enum(["in", "out"]), reason: z.enum(STOCK_REASONS), unit_cost: num.optional(), occurred_on: opt }),
  z.object({ kind: z.literal("customer"), name: z.string().trim().min(1).max(120), phone: opt, notes: opt }),
]);

const day = (d?: string) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T12:00:00Z` : undefined);

export async function recordEntry(_: ActionState, formData: FormData): Promise<ActionState> {
  const businessId = z.uuid().safeParse(formData.get("businessId"));
  const raw = Object.fromEntries([...formData.entries()].filter(([, v]) => v !== ""));
  const parsed = entrySchema.safeParse(raw);
  if (!businessId.success || !parsed.success) return fail("Please check the highlighted fields.", parsed.success ? undefined : z.flattenError(parsed.error).fieldErrors as Record<string, string[]>);
  const { business, supabase } = await requireBusiness(businessId.data, WRITER_ROLES);
  const cur = business.currency;
  const e = parsed.data;

  let fields: Record<string, unknown>;
  switch (e.kind) {
    case "sale": {
      const unit = toMinor(e.unit_price, cur);
      const total = Math.round(unit * e.quantity);
      fields = {
        occurred_at: day(e.occurred_on), customer_name: e.customer_name, payment_method: e.payment_method, total_minor: total,
        amount_paid_minor: e.payment_method === "credit" ? toMinor(e.amount_paid ?? 0, cur) : undefined,
        items: [{ description: e.description, product_name: e.description, quantity: e.quantity, unit_price_minor: unit }],
      };
      break;
    }
    case "expense":
      fields = { occurred_at: day(e.occurred_on), category: e.category, amount_minor: toMinor(e.amount, cur), payment_method: e.payment_method, supplier: e.supplier, description: e.description };
      break;
    case "stock_movement":
      fields = { occurred_at: day(e.occurred_on), product_name: e.product_name, quantity_delta: e.direction === "in" ? e.quantity : -e.quantity, reason: e.reason,
        unit_cost_minor: e.unit_cost === undefined ? undefined : toMinor(e.unit_cost, cur) };
      break;
    case "customer":
      fields = { name: e.name, phone: e.phone, notes: e.notes };
      break;
  }
  const valid = fieldsSchemaByKind[e.kind].safeParse(fields);
  if (!valid.success) return fail(valid.error.issues[0]?.message ?? "Please check the values.");
  const { error } = await supabase.rpc("record_entry", {
    p_business_id: businessId.data,
    p_kind: e.kind,
    p_fields: JSON.parse(JSON.stringify(valid.data)) as Json,
  });
  if (error) return fail(friendlyDbError(error));
  revalidatePath(`/b/${businessId.data}`, "layout");
  return { ok: true, message: "Saved." };
}

export async function voidRecord(formData: FormData) {
  const businessId = z.uuid().parse(formData.get("businessId"));
  const kind = z.enum(RECORD_KINDS).parse(formData.get("kind"));
  const id = z.uuid().parse(formData.get("id"));
  const { supabase } = await requireBusiness(businessId, WRITER_ROLES);
  await supabase.rpc("void_record", { p_kind: kind, p_id: id, p_reason: "Voided from records" });
  revalidatePath(`/b/${businessId}`, "layout");
}
