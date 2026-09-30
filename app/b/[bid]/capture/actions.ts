"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireBusiness, WRITER_ROLES } from "@/lib/auth/guards";
import { fail, friendlyDbError, parseForm, type ActionState } from "@/lib/actions";
import { enforceRateLimit, LIMITS, RateLimitError } from "@/lib/rate-limit";
import { processCaptureSoon } from "@/lib/capture/process";
import { toMinor } from "@/lib/money";
import { fieldsSchemaByKind, PAYMENT_METHODS, STOCK_REASONS, type RecordKind } from "@/lib/records/schemas";
import type { Json } from "@/lib/supabase/database.types";

const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_PHOTO_BYTES = 6 * 1024 * 1024;

const captureSchema = z.object({
  businessId: z.uuid(),
  channel: z.enum(["text", "voice", "photo", "forward"]),
  text: z.string().trim().max(4000).optional(),
  clientRef: z.string().min(8).max(100),
});

export async function createCapture(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseForm(captureSchema, formData);
  if (!parsed.ok) return parsed.state;
  const { businessId, channel, text, clientRef } = parsed.data;
  const { user, supabase } = await requireBusiness(businessId, WRITER_ROLES);
  try {
    await enforceRateLimit(`capture:${user.id}`, LIMITS.capture);
  } catch (e) {
    if (e instanceof RateLimitError) return fail(e.message);
    throw e;
  }

  const photo = formData.get("photo");
  let storagePath: string | null = null;
  let mimeType: string | null = null;
  if (photo instanceof File && photo.size > 0) {
    if (!PHOTO_TYPES.includes(photo.type)) return fail("Use a JPEG, PNG or WebP photo.");
    if (photo.size > MAX_PHOTO_BYTES) return fail("That photo is too large. Try again with a smaller one.");
    storagePath = `${businessId}/${randomUUID()}.${photo.type.split("/")[1]}`;
    mimeType = photo.type;
    const { error } = await supabase.storage.from("captures").upload(storagePath, photo, { contentType: photo.type });
    if (error) return fail("We couldn't upload that photo. Check your connection and try again.");
  }
  if (!text && !storagePath) return fail("Say, type or photograph something first.");

  const { data: capture, error } = await supabase
    .from("captures")
    .insert({ business_id: businessId, channel: storagePath ? "photo" : channel, raw_text: text || null, storage_path: storagePath, mime_type: mimeType, client_ref: clientRef })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return { ok: true, message: "Already received." };
    return fail(friendlyDbError(error));
  }
  processCaptureSoon(capture.id);
  revalidatePath(`/b/${businessId}`);
  return { ok: true, message: "Got it. Reading it now…" };
}

// Editable fields arrive in major units; everything else is carried over from the draft.
const editSchema = z.object({
  businessId: z.uuid(),
  draftId: z.uuid(),
  customer_name: z.string().trim().max(120).optional(),
  total: z.coerce.number().nonnegative().optional(),
  amount_paid: z.coerce.number().nonnegative().optional(),
  amount: z.coerce.number().nonnegative().optional(),
  payment_method: z.enum(PAYMENT_METHODS).optional(),
  category: z.string().trim().max(60).optional(),
  supplier: z.string().trim().max(120).optional(),
  product_name: z.string().trim().max(120).optional(),
  quantity_delta: z.coerce.number().optional(),
  reason: z.enum(STOCK_REASONS).optional(),
  name: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(32).optional(),
});

function applyEdits(kind: RecordKind, fields: Record<string, unknown>, e: z.infer<typeof editSchema>, currency: string) {
  const clean = (v: string | undefined) => (v === "" ? undefined : v);
  const next = { ...fields };
  switch (kind) {
    case "sale":
      if (e.customer_name !== undefined) next.customer_name = clean(e.customer_name);
      if (e.total !== undefined) next.total_minor = toMinor(e.total, currency);
      if (e.payment_method) next.payment_method = e.payment_method;
      next.amount_paid_minor = e.payment_method === "credit" ? toMinor(e.amount_paid ?? 0, currency) : undefined;
      break;
    case "expense":
      if (e.amount !== undefined) next.amount_minor = toMinor(e.amount, currency);
      if (e.category !== undefined) next.category = e.category;
      if (e.payment_method) next.payment_method = e.payment_method;
      if (e.supplier !== undefined) next.supplier = clean(e.supplier);
      break;
    case "stock_movement":
      if (e.product_name !== undefined) next.product_name = e.product_name;
      if (e.quantity_delta !== undefined) next.quantity_delta = e.quantity_delta;
      if (e.reason) next.reason = e.reason;
      break;
    case "customer":
      if (e.name !== undefined) next.name = e.name;
      if (e.phone !== undefined) next.phone = clean(e.phone);
      break;
  }
  return fieldsSchemaByKind[kind].safeParse(next);
}

export async function confirmDraft(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = parseForm(editSchema, formData);
  if (!parsed.ok) return parsed.state;
  const { businessId, draftId } = parsed.data;
  const { business, supabase } = await requireBusiness(businessId, WRITER_ROLES);
  const { data: draft } = await supabase.from("record_drafts").select("kind, fields, status").eq("id", draftId).maybeSingle();
  if (!draft || draft.status !== "proposed") return fail("This draft was already handled.");

  const fields = applyEdits(draft.kind, draft.fields as Record<string, unknown>, parsed.data, business.currency);
  if (!fields.success) return fail(fields.error.issues[0]?.message ?? "Please check the values.");
  const { error } = await supabase.rpc("confirm_draft", {
    p_draft_id: draftId,
    p_fields: JSON.parse(JSON.stringify(fields.data)) as Json,
  });
  if (error) return fail(friendlyDbError(error));
  revalidatePath(`/b/${businessId}`, "layout");
  return { ok: true, message: "Saved to your books." };
}

export async function rejectDraft(formData: FormData) {
  const businessId = z.uuid().parse(formData.get("businessId"));
  const draftId = z.uuid().parse(formData.get("draftId"));
  const { supabase } = await requireBusiness(businessId, WRITER_ROLES);
  await supabase.rpc("reject_draft", { p_draft_id: draftId });
  revalidatePath(`/b/${businessId}`);
}
