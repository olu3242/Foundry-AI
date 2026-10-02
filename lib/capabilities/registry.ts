import "server-only";
import { serverEnv } from "@/lib/env";
import { PROVIDERS } from "@/lib/messaging/providers";
import { paystackConfigured } from "@/lib/payments/paystack";
import type { FoundryCapabilityIntent } from "@/lib/orchestration/types";

export type CapabilityHealth = "healthy" | "degraded" | "unavailable";
export type CapabilityResolution =
  | { allowed: true; health: "healthy"; capability: FoundryCapabilityIntent; provider?: string | null }
  | { allowed: false; health: CapabilityHealth; reason: string; retryable: boolean };

function messaging(intent: FoundryCapabilityIntent): CapabilityResolution {
  if (serverEnv().MESSAGING_ENABLED === "0") {
    return { allowed: false, health: "degraded", reason: "messaging_paused", retryable: true };
  }
  const requested = intent.provider ?? null;
  const available = PROVIDERS.filter((p) => p.configured());
  if (requested) {
    const provider = available.find((p) => p.name === requested);
    return provider
      ? { allowed: true, health: "healthy", capability: intent, provider: provider.name }
      : { allowed: false, health: "unavailable", reason: "messaging_provider_unavailable", retryable: true };
  }
  if (!available.length) {
    return { allowed: false, health: "unavailable", reason: "no_messaging_provider_configured", retryable: true };
  }
  return { allowed: true, health: "healthy", capability: intent, provider: null };
}

export function resolveCapability(intent: FoundryCapabilityIntent | null | undefined): CapabilityResolution {
  if (!intent) return { allowed: true, health: "healthy", capability: { kind: "internal.none" } };

  switch (intent.kind) {
    case "internal.compute":
    case "workflow.engine":
      return { allowed: true, health: "healthy", capability: intent, provider: intent.provider ?? null };
    case "messaging":
      return messaging(intent);
    case "payments.paystack":
      return paystackConfigured()
        ? { allowed: true, health: "healthy", capability: intent, provider: "paystack" }
        : { allowed: false, health: "unavailable", reason: "paystack_not_configured", retryable: true };
    case "webhook.egress":
      return { allowed: true, health: "healthy", capability: intent, provider: "webhook" };
    case "fx.feed":
      return serverEnv().FX_PROVIDER && serverEnv().FX_API_KEY
        ? { allowed: true, health: "healthy", capability: intent, provider: serverEnv().FX_PROVIDER }
        : { allowed: false, health: "unavailable", reason: "fx_provider_not_configured", retryable: true };
    default:
      return { allowed: false, health: "unavailable", reason: "unknown_capability", retryable: false };
  }
}
