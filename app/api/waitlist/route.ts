import { createHash, createHmac } from "node:crypto";
import { publicEnv, serverEnv } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { normalizeWaitlistContact, waitlistSubmissionSchema } from "@/lib/waitlist";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PRIVATE_HEADERS = { "Cache-Control": "no-store" };
const RATE_LIMIT = { limit: 5, windowSeconds: 3600 };

function respond(status: number, body: { received?: boolean; error?: string }, extraHeaders?: HeadersInit) {
  return Response.json(body, { status, headers: { ...PRIVATE_HEADERS, ...extraHeaders } });
}

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  const requestUrl = new URL(request.url);
  try {
    return new URL(origin).origin === requestUrl.origin;
  } catch {
    return false;
  }
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

async function readJsonBody(request: Request): Promise<{ tooLarge: boolean; value: unknown }> {
  const reader = request.body?.getReader();
  if (!reader) return { tooLarge: false, value: null };

  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4096) {
        await reader.cancel();
        return { tooLarge: true, value: null };
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return { tooLarge: false, value: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch {
    return { tooLarge: false, value: null };
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return respond(403, { error: "origin_not_allowed" });
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return respond(415, { error: "json_required" });
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 4096) return respond(413, { error: "request_too_large" });

  const body = await readJsonBody(request);
  if (body.tooLarge) return respond(413, { error: "request_too_large" });

  const parsed = waitlistSubmissionSchema.safeParse(body.value);
  if (!parsed.success) return respond(400, { error: "invalid_submission" });

  // The hidden field makes automated submissions appear successful without retaining data.
  if (parsed.data.website.trim()) return respond(201, { received: true });

  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
    ?? "unknown";

  try {
    const env = serverEnv();
    const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
    const limited = await rateLimit(`waitlist:${sha256(clientIp)}`, RATE_LIMIT);
    if (!limited) {
      return respond(429, { error: "rate_limited" }, { "Retry-After": String(RATE_LIMIT.windowSeconds) });
    }

    const contact = normalizeWaitlistContact(parsed.data.contact);
    const contactHash = createHmac("sha256", env.PASSPORT_TOKEN_PEPPER).update(contact).digest("hex");
    const endpoint = new URL("/rest/v1/waitlist_signups?on_conflict=contact_hash", publicEnv.NEXT_PUBLIC_SUPABASE_URL);
    const stored = await fetch(endpoint, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "resolution=ignore-duplicates,return=minimal",
      },
      body: JSON.stringify({
        role: parsed.data.role,
        contact: parsed.data.contact.trim(),
        contact_hash: contactHash,
        country: parsed.data.country || null,
        consented_at: new Date().toISOString(),
      }),
      cache: "no-store",
    });

    if (!stored.ok) return respond(503, { error: "waitlist_unavailable" });
    return respond(201, { received: true });
  } catch {
    return respond(503, { error: "waitlist_unavailable" });
  }
}