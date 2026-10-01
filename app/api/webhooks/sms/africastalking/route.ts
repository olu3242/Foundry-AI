import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { tokenMatches } from "@/lib/messaging/signatures";
import { reportError } from "@/lib/telemetry";

export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = { Success: "delivered", Sent: "sent", Buffered: "sent", Submitted: "sent", Failed: "failed", Rejected: "failed" };

/**
 * B42 Africa's Talking delivery reports and inbound SMS. AT doesn't sign callbacks, so the
 * callback URL carries a secret token (?token=…) compared in constant time.
 */
export async function POST(request: NextRequest) {
  if (!tokenMatches(request.nextUrl.searchParams.get("token"), serverEnv().AFRICASTALKING_CALLBACK_TOKEN)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const form = new URLSearchParams(await request.text());
  const admin = createAdminClient();
  try {
    if (form.get("status") && form.get("id")) {
      const status = STATUS[form.get("status")!];
      if (status) {
        const { error } = await admin.rpc("record_message_receipt", { p_provider: "africastalking", p_provider_message_id: form.get("id")!, p_status: status,
          p_event_id: `at:${form.get("id")}:${form.get("status")}`, p_detail: form.get("failureReason") ? { error: form.get("failureReason") } : {} });
        if (error) throw error;
      }
    } else if (form.get("from") && form.get("text") !== null) {
      const { error } = await admin.rpc("record_inbound_message", { p_provider: "africastalking", p_from: form.get("from")!, p_text: form.get("text") ?? "",
        p_event_id: `at-in:${form.get("id") ?? `${form.get("from")}:${form.get("date")}`}` });
      if (error) throw error;
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    reportError(error, { msg: "africastalking.webhook.failed" });
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }
}
