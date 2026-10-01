import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { tokenMatches, verifyMetaSignature } from "@/lib/messaging/signatures";
import { log, reportError } from "@/lib/telemetry";

export const dynamic = "force-dynamic";

/** Meta webhook verification handshake. */
export function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  if (q.get("hub.mode") === "subscribe" && tokenMatches(q.get("hub.verify_token"), serverEnv().WHATSAPP_VERIFY_TOKEN)) {
    return new NextResponse(q.get("hub.challenge") ?? "", { status: 200 });
  }
  return NextResponse.json({ error: "forbidden" }, { status: 403 });
}

type Change = { value?: {
  statuses?: { id: string; status: string; timestamp?: string; errors?: { title?: string; message?: string }[] }[];
  messages?: { id: string; from: string; text?: { body?: string } }[];
} };

/** B42 delivery receipts and inbound replies (STOP) from WhatsApp, signature-verified on the raw body. */
export async function POST(request: NextRequest) {
  const secret = serverEnv().WHATSAPP_APP_SECRET;
  const raw = await request.text();
  if (!secret || !verifyMetaSignature(raw, request.headers.get("x-hub-signature-256"), secret)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }
  const admin = createAdminClient();
  try {
    const body = JSON.parse(raw) as { entry?: { changes?: Change[] }[] };
    for (const change of (body.entry ?? []).flatMap((e) => e.changes ?? [])) {
      for (const s of change.value?.statuses ?? []) {
        const status = ["sent", "delivered", "read", "failed"].includes(s.status) ? s.status : null;
        if (!status) continue;
        const { error } = await admin.rpc("record_message_receipt", { p_provider: "whatsapp_cloud", p_provider_message_id: s.id, p_status: status,
          p_event_id: `wa:${s.id}:${s.status}:${s.timestamp ?? ""}`, p_detail: s.errors?.length ? { error: s.errors[0]!.message ?? s.errors[0]!.title ?? "failed" } : {} });
        if (error) throw error;
      }
      for (const m of change.value?.messages ?? []) {
        const { error } = await admin.rpc("record_inbound_message", { p_provider: "whatsapp_cloud", p_from: m.from, p_text: m.text?.body ?? "", p_event_id: `wa-in:${m.id}` });
        if (error) throw error;
      }
    }
    log("info", "whatsapp.webhook", { entries: body.entry?.length ?? 0 });
    return NextResponse.json({ received: true });
  } catch (error) {
    reportError(error, { msg: "whatsapp.webhook.failed" });
    return NextResponse.json({ error: "processing failed" }, { status: 500 });   // Meta retries
  }
}
