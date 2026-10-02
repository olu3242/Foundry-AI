import type { Json } from "@/lib/supabase/database.types";

export type FoundryAuthorityMode = "auto" | "hil" | "operator" | "blocked";
export type FoundryFlowStage =
  | "triggered"
  | "context_loaded"
  | "decided"
  | "policy_checked"
  | "awaiting_approval"
  | "ready"
  | "executing"
  | "verifying"
  | "completed"
  | "failed";

export type FoundryCapabilityIntent = {
  kind: string;
  provider?: string | null;
  action?: string | null;
};

export type FoundryFlowEnvelope = {
  flow_id: string;
  flow_type: string;
  stage: FoundryFlowStage;
  correlation_id: string;
  decision_id?: string | null;
  intervention_id?: string | null;
  authority_mode: FoundryAuthorityMode;
  approval_required: boolean;
  capability?: FoundryCapabilityIntent | null;
  evidence_required: boolean;
  triggered_by: string;
  created_at: string;
  metadata?: Json;
};

export type FoundryFlowInput = Omit<FoundryFlowEnvelope, "created_at"> & { created_at?: string };
