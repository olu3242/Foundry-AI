import type { FoundryFlowEnvelope } from "./types";

export type FlowExecutionGate =
  | { allowed: true }
  | { allowed: false; reason: "blocked" | "approval_required" | "invalid_stage" };

const EXECUTABLE_STAGES = new Set<FoundryFlowEnvelope["stage"]>(["ready", "executing"]);

export function evaluateFlowExecution(flow: FoundryFlowEnvelope | null): FlowExecutionGate {
  if (!flow) return { allowed: true };
  if (flow.authority_mode === "blocked") return { allowed: false, reason: "blocked" };
  if (flow.approval_required && flow.authority_mode !== "auto") return { allowed: false, reason: "approval_required" };
  if (!EXECUTABLE_STAGES.has(flow.stage)) return { allowed: false, reason: "invalid_stage" };
  return { allowed: true };
}
