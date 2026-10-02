import { randomUUID } from "node:crypto";
import type { Json } from "@/lib/supabase/database.types";
import type { FoundryFlowEnvelope, FoundryFlowInput } from "./types";

const FLOW_KEY = "_foundry_flow";

export function createFlowEnvelope(input: Partial<FoundryFlowInput> & Pick<FoundryFlowInput, "flow_type">): FoundryFlowEnvelope {
  return {
    flow_id: input.flow_id ?? randomUUID(),
    flow_type: input.flow_type,
    stage: input.stage ?? "triggered",
    correlation_id: input.correlation_id ?? randomUUID(),
    decision_id: input.decision_id ?? null,
    intervention_id: input.intervention_id ?? null,
    authority_mode: input.authority_mode ?? "operator",
    approval_required: input.approval_required ?? false,
    capability: input.capability ?? null,
    evidence_required: input.evidence_required ?? true,
    triggered_by: input.triggered_by ?? "system",
    created_at: input.created_at ?? new Date().toISOString(),
    metadata: input.metadata ?? {},
  };
}

export function attachFlow(payload: Json | undefined, flow: FoundryFlowEnvelope): Json {
  const base = payload && typeof payload === "object" && !Array.isArray(payload) ? payload as Record<string, Json> : {};
  return { ...base, [FLOW_KEY]: flow as unknown as Json };
}

export function readFlow(payload: Json | null | undefined): FoundryFlowEnvelope | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const candidate = (payload as Record<string, unknown>)[FLOW_KEY];
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
  const c = candidate as Record<string, unknown>;
  if (typeof c.flow_id !== "string" || typeof c.flow_type !== "string" || typeof c.stage !== "string" || typeof c.correlation_id !== "string") return null;
  return candidate as FoundryFlowEnvelope;
}

export function advanceFlow(flow: FoundryFlowEnvelope, stage: FoundryFlowEnvelope["stage"]): FoundryFlowEnvelope {
  return { ...flow, stage };
}
