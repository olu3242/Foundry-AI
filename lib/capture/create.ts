import "server-only";
import { randomUUID } from "node:crypto";
import type { ServerSupabase } from "@/lib/supabase/server";
import { friendlyDbError } from "@/lib/actions";
import { processCaptureSoon } from "./process";

const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_PHOTO_BYTES = 6 * 1024 * 1024;

export type NewCapture = {
  businessId: string;
  channel: "text" | "voice" | "photo" | "forward";
  text?: string | null;
  clientRef: string;
  photo?: File | null;
};

export type CreateCaptureResult =
  | { ok: true; id: string | null; duplicate: boolean }
  | { ok: false; error: string; status: number };

/** Shared by the composer's server action and the offline outbox endpoint. RLS enforces write access. */
export async function createCaptureRecord(supabase: ServerSupabase, input: NewCapture): Promise<CreateCaptureResult> {
  let storagePath: string | null = null;
  let mimeType: string | null = null;
  const photo = input.photo;
  if (photo && photo.size > 0) {
    if (!PHOTO_TYPES.includes(photo.type)) return { ok: false, error: "Use a JPEG, PNG or WebP photo.", status: 415 };
    if (photo.size > MAX_PHOTO_BYTES) return { ok: false, error: "That photo is too large. Try again with a smaller one.", status: 413 };
    storagePath = `${input.businessId}/${randomUUID()}.${photo.type.split("/")[1]}`;
    mimeType = photo.type;
    const { error } = await supabase.storage.from("captures").upload(storagePath, photo, { contentType: photo.type });
    if (error) return { ok: false, error: "We couldn't upload that photo. Check your connection and try again.", status: 502 };
  }
  const text = input.text?.trim() || null;
  if (!text && !storagePath) return { ok: false, error: "Say, type or photograph something first.", status: 400 };

  const { data, error } = await supabase
    .from("captures")
    .insert({
      business_id: input.businessId,
      channel: storagePath ? "photo" : input.channel,
      raw_text: text,
      storage_path: storagePath,
      mime_type: mimeType,
      client_ref: input.clientRef,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return { ok: true, id: null, duplicate: true };
    return { ok: false, error: friendlyDbError(error), status: error.code === "42501" ? 403 : 400 };
  }
  processCaptureSoon(data.id);
  return { ok: true, id: data.id, duplicate: false };
}
