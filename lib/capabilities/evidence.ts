import type { Json } from "@/lib/supabase/database.types";
import type { FoundryFlowEnvelope } from "@/lib/orchestration/types";

export function hasExecutionEvidence(flow: FoundryFlowEnvelope | null, result: Json | void): boolean {
  if (!flow?.evidence_required) return true;
  if (result === null || result === undefined) return false;
  if (typeof result !== "object" || Array.isArray(result)) return false;
  const record = result as Record<string, unknown>;

  switch (flow.capability?.kind) {
    case "messaging":
      return typeof record.sent === "string" && typeof record.provider === "string";
    case "webhook.egress":
      return typeof record.delivered === "string" && typeof record.status === "number";
    case "payments.paystack":
      return typeof record.reference === "string" || typeof record.reconciled === "number";
    case "fx.feed":
      return typeof record.updated === "number";
    default:
      return Object.keys(record).length > 0;
  }
}
