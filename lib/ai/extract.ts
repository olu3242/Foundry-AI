import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { aiModel, getAnthropic } from "./client";
import { extractionSchema, type Extraction } from "./extraction-schema";

export type ExtractionInput = {
  text?: string | null;
  image?: { base64: string; mediaType: "image/jpeg" | "image/png" | "image/webp" } | null;
  currency: string;
  today: string;
  knownProducts: string[];
  knownCustomers: string[];
  market?: { name: string; languages: string[]; mobileMoney: string[] };
};

export type ExtractionResult =
  | { ok: true; extraction: Extraction; model: string; usage: { input: number; output: number } }
  | { ok: false; reason: "refused" | "unparseable" | "truncated"; model: string; detail?: string; usage: { input: number; output: number } };

// Frozen so it caches; everything per-request goes in the user turn.
const SYSTEM = `You turn what a small-business owner says, types, forwards or photographs into bookkeeping records for Foundry, a business operating system used by small and informal businesses across Africa.

Inputs are often informal: pidgin, local languages mixed with English, shorthand ("2 bags @ 45k"), receipts, handwritten notebook pages, or WhatsApp messages. "k" means thousand. Mobile money includes MoMo, M-Pesa, OPay, Airtel Money and similar.

Rules:
- Extract only what the input supports. Never invent customers, prices or quantities. If a sale's unit price is missing but a total is given, use one item with quantity 1 at the total.
- One input can contain several records (e.g. two sales and an expense). Return each separately.
- Amounts are in the business's currency, in normal units as people say them (45,000 not 4500000).
- A sale on credit ("will pay later", "owes") uses payment_method "credit" and amount_paid for any part-payment.
- Buying goods for resale is a stock_movement with reason "purchase" (positive quantity_delta). Also record the money paid as an expense only if the input says it was paid.
- Record a customer on its own only when the input is about the customer (e.g. a new contact), not for every sale.
- For evidence, quote the exact words that support each field. Keep explanations to one short sentence in plain language.
- If nothing in the input is a business record, return no records and say why in note_for_user.
- Lower your confidence when you had to guess (unclear handwriting, ambiguous amounts, missing prices).`;

export async function extractRecords(input: ExtractionInput): Promise<ExtractionResult> {
  const client = getAnthropic();
  if (!client) throw new Error("ANTHROPIC_API_KEY is not configured");
  const model = aiModel();

  const context = [
    `Currency: ${input.currency}`,
    `Today: ${input.today}`,
    input.knownProducts.length ? `Known products: ${input.knownProducts.join("; ")}` : null,
    input.knownCustomers.length ? `Known customers: ${input.knownCustomers.join("; ")}` : null,
    input.market ? `Market: ${input.market.name}; languages: ${input.market.languages.join(", ")}; mobile money here: ${input.market.mobileMoney.join(", ") || "n/a"}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (input.image) {
    content.push({ type: "image", source: { type: "base64", media_type: input.image.mediaType, data: input.image.base64 } });
  }
  content.push({
    type: "text",
    text: `${context}\n\n<capture>\n${input.text?.trim() || "(see photo)"}\n</capture>`,
  });

  const response = await client.beta.messages.parse({
    model,
    max_tokens: 16000,
    // Refusal fallback: re-run on Anthropic's recommended model for the refusal category.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    // Extraction is routine; low effort keeps latency and cost down.
    output_config: { effort: "low", format: betaZodOutputFormat(extractionSchema) },
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content }],
  });

  const usage = { input: response.usage.input_tokens, output: response.usage.output_tokens };
  if (response.stop_reason === "refusal") {
    return { ok: false, reason: "refused", model: response.model, detail: response.stop_details?.category ?? undefined, usage };
  }
  if (response.stop_reason === "max_tokens") return { ok: false, reason: "truncated", model: response.model, usage };
  if (!response.parsed_output) return { ok: false, reason: "unparseable", model: response.model, usage };
  return { ok: true, extraction: response.parsed_output, model: response.model, usage };
}
