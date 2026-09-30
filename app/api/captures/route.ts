import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createCaptureRecord } from "@/lib/capture/create";
import { enforceRateLimit, LIMITS, RateLimitError } from "@/lib/rate-limit";
import { IdempotencyConflictError, withIdempotency } from "@/lib/idempotency";
import { withSpan } from "@/lib/telemetry";

export const dynamic = "force-dynamic";

const schema = z.object({
  businessId: z.uuid(),
  channel: z.enum(["text", "voice", "photo", "forward"]),
  text: z.string().max(4000).optional(),
});

/**
 * Offline outbox sync. The client retries until it gets a 2xx or 4xx; the
 * Idempotency-Key (the capture's client_ref) makes retries safe.
 */
export async function POST(request: NextRequest) {
  const key = request.headers.get("idempotency-key") ?? "";
  if (!/^[\w-]{8,100}$/.test(key)) return NextResponse.json({ error: "Idempotency-Key header required" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in again to send saved captures." }, { status: 401 });

  const form = await request.formData();
  const parsed = schema.safeParse(Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string")));
  if (!parsed.success) return NextResponse.json({ error: "Invalid capture" }, { status: 422 });
  const photo = form.get("photo");

  try {
    await enforceRateLimit(`capture:${user.id}`, LIMITS.capture);
    const { response, replayed } = await withSpan("capture.sync", { user_id: user.id, business_id: parsed.data.businessId }, () =>
      withIdempotency(`captures:${user.id}`, key, { ...parsed.data, photoBytes: photo instanceof File ? photo.size : 0 }, async () => {
        const result = await createCaptureRecord(supabase, { ...parsed.data, clientRef: key, photo: photo instanceof File ? photo : null });
        if (!result.ok) throw Object.assign(new Error(result.error), { status: result.status });
        return { id: result.id, duplicate: result.duplicate };
      }),
    );
    return NextResponse.json({ ...response, replayed }, { status: replayed || response.duplicate ? 200 : 201 });
  } catch (error) {
    if (error instanceof RateLimitError) return NextResponse.json({ error: error.message }, { status: 429 });
    if (error instanceof IdempotencyConflictError) return NextResponse.json({ error: error.message }, { status: 409 });
    const status = (error as { status?: number }).status;
    if (status) return NextResponse.json({ error: (error as Error).message }, { status });
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
