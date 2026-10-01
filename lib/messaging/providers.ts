import "server-only";
import { serverEnv } from "@/lib/env";
import { safeFetch } from "@/lib/net/safe-fetch";

/**
 * B42 vendor-neutral delivery. Workflows never call a vendor: they queue messages; the worker
 * picks the adapter for the message's channel. Add a provider by implementing this interface.
 */
export type Outbound = { to: string; body: string; template: { name: string | null; locale: string; params: string[] } | null };
export type MessagingProvider = { name: string; channel: "whatsapp" | "sms"; configured(): boolean; send(m: Outbound): Promise<{ providerMessageId: string }> };

export class PermanentSendError extends Error {}

/** Meta WhatsApp Cloud API. Business-initiated messages must use an approved template. */
export const whatsappCloud: MessagingProvider = {
  name: "whatsapp_cloud",
  channel: "whatsapp",
  configured: () => Boolean(serverEnv().WHATSAPP_PHONE_NUMBER_ID && serverEnv().WHATSAPP_ACCESS_TOKEN),
  async send(m) {
    const env = serverEnv();
    if (!m.template?.name) throw new PermanentSendError("WhatsApp needs an approved template for this message");
    const base = env.WHATSAPP_API_BASE ?? "https://graph.facebook.com";
    const res = await safeFetch(`${base}/v21.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp", to: m.to, type: "template",
        template: { name: m.template.name, language: { code: m.template.locale },
          components: [{ type: "body", parameters: m.template.params.map((text) => ({ type: "text", text })) }] },
      }),
    });
    const json = JSON.parse(res.text || "{}") as { messages?: { id: string }[]; error?: { message: string; code?: number } };
    if (!res.ok || !json.messages?.[0]?.id) {
      const msg = json.error?.message ?? `HTTP ${res.status}`;
      // 4xx (bad number, template not approved) won't succeed on retry.
      if (res.status >= 400 && res.status < 500 && res.status !== 429) throw new PermanentSendError(msg);
      throw new Error(msg);
    }
    return { providerMessageId: json.messages[0].id };
  },
};

/** Africa's Talking SMS (covers NG, GH, KE, RW, UG, ...). */
export const africasTalkingSms: MessagingProvider = {
  name: "africastalking",
  channel: "sms",
  configured: () => Boolean(serverEnv().AFRICASTALKING_USERNAME && serverEnv().AFRICASTALKING_API_KEY),
  async send(m) {
    const env = serverEnv();
    const base = env.AFRICASTALKING_API_BASE
      ?? (env.AFRICASTALKING_USERNAME === "sandbox" ? "https://api.sandbox.africastalking.com" : "https://api.africastalking.com");
    const form = new URLSearchParams({ username: env.AFRICASTALKING_USERNAME!, to: `+${m.to}`, message: m.body });
    if (env.AFRICASTALKING_SENDER_ID) form.set("from", env.AFRICASTALKING_SENDER_ID);
    const res = await safeFetch(`${base}/version1/messaging`, {
      method: "POST", body: form.toString(),
      headers: { apiKey: env.AFRICASTALKING_API_KEY!, Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    });
    const json = JSON.parse(res.text || "{}") as { SMSMessageData?: { Recipients?: { messageId: string; status: string; statusCode: number }[] } };
    const r = json.SMSMessageData?.Recipients?.[0];
    if (!res.ok || !r || ![100, 101, 102].includes(r.statusCode)) {
      if (r && [403, 404, 405, 406, 407].includes(r.statusCode)) throw new PermanentSendError(r.status);
      throw new Error(r?.status ?? `HTTP ${res.status}`);
    }
    return { providerMessageId: r.messageId };
  },
};

export const PROVIDERS: MessagingProvider[] = [whatsappCloud, africasTalkingSms];
export const providerFor = (channel: string) => PROVIDERS.find((p) => p.channel === channel && p.configured()) ?? null;
