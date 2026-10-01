import "server-only";
import { PermanentJobError, type JobHandler } from "@/lib/jobs/types";
import { serverEnv } from "@/lib/env";
import { PermanentSendError, providerFor } from "./providers";

type Msg = { id: string; status: string; phone: string; channel: string; body: string; consented: boolean;
  template: { name: string | null; locale: string; params: string[] } | null };

/** B42: deliver one queued message through the channel's adapter. Retries are the job queue's. */
export const sendMessageJob: JobHandler = async ({ job, admin }) => {
  const id = (job.payload as { message_id?: string }).message_id;
  if (!id) throw new PermanentJobError("payload.message_id missing");
  const { data } = await admin.rpc("message_for_send", { p_message_id: id });
  const m = data as unknown as Msg | null;
  if (!m) throw new PermanentJobError("message not found");
  if (m.status !== "queued") return { skipped: m.status };
  // Consent is re-checked at send time: an opt-out after queueing wins.
  if (!m.consented) {
    await admin.rpc("suppress_message", { p_message_id: id, p_reason: "consent_withdrawn" });
    return { suppressed: "consent_withdrawn" };
  }
  if (serverEnv().MESSAGING_ENABLED === "0") throw new Error("Messaging paused (MESSAGING_ENABLED=0): held for retry");
  const provider = providerFor(m.channel);
  if (!provider) {
    await admin.rpc("suppress_message", { p_message_id: id, p_reason: "no_provider_configured" });
    return { suppressed: "no_provider_configured" };
  }
  try {
    const { providerMessageId } = await provider.send({ to: m.phone, body: m.body, template: m.template });
    await admin.rpc("record_message_send", { p_message_id: id, p_provider: provider.name, p_provider_message_id: providerMessageId, p_error: "", p_final: false });
    return { sent: providerMessageId, provider: provider.name };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    const final = e instanceof PermanentSendError || job.attempts >= job.max_attempts;
    await admin.rpc("record_message_send", { p_message_id: id, p_provider: provider.name, p_provider_message_id: "", p_error: error, p_final: final });
    if (e instanceof PermanentSendError) throw new PermanentJobError(error);
    throw e;
  }
};
