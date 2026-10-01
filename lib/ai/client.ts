import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { serverEnv } from "@/lib/env";

let client: Anthropic | null | undefined;

/** Null when no API key is configured (callers degrade instead of crashing). */
export function getAnthropic() {
  if (client === undefined) {
    const key = serverEnv().ANTHROPIC_API_KEY;
    client = key ? new Anthropic({ apiKey: key, maxRetries: 2, timeout: 35_000 }) : null;
  }
  return client;
}

export function aiModel() {
  return serverEnv().AI_EXTRACTION_MODEL;
}
