# Foundry Orchestration Kernel

The kernel is a compatibility layer over the existing B1–B60 engines. It does not replace jobs, playbooks, decisions, policies, interventions, messaging or outcomes.

## Canonical path

`event -> flow envelope -> queue -> runtime -> domain handler -> capability -> execution evidence -> outcome -> memory/learning`

Every adopted flow carries:
- `flow_id`: stable identity for the business operation.
- `correlation_id`: trace identity across runtime/provider boundaries.
- `flow_type`: semantic operation, independent of the concrete job type.
- `stage`: lifecycle position.
- `decision_id` / `intervention_id`: optional links to existing governed objects.
- `authority_mode`: `auto`, `hil`, `operator`, or `blocked`.
- `approval_required`: explicit HIL requirement.
- `capability`: intended execution capability/provider/action.
- `evidence_required`: whether completion must be backed by evidence.
- `triggered_by`: event, cron, person, policy or subsystem that initiated the flow.

## Compatibility rule

Legacy jobs without `_foundry_flow` remain valid. Domains adopt the kernel incrementally. The durable job table and existing retry/dead-letter semantics remain authoritative for runtime execution.

## Initial adoption

- Daily per-business Pulse computation: `business.daily_intelligence`.
- Vertical-pack workflow evaluation: `business.pack_workflows`.

Runtime success/failure telemetry now includes flow/correlation/authority/capability fields when present.

## Invariants

1. An LLM response alone is never execution success.
2. Policy and authority remain authoritative; the envelope records them but does not bypass them.
3. HIL-required flows cannot be treated as autonomous merely because they reached the queue.
4. External execution must preserve provider/target-system evidence through the existing domain mechanism.
5. A retry keeps the same flow identity because the envelope is part of the durable job payload.
6. Existing B1–B60 domain state remains the source of truth; the kernel coordinates rather than duplicates it.

## Runtime enforcement

Kernel-aware jobs are fail-closed before their domain handler runs:

- `authority_mode=blocked` -> denied.
- `approval_required=true` with non-auto authority -> denied until an approval transition clears the requirement.
- only `ready` or `executing` stages may enter a handler.
- legacy jobs without an envelope remain compatible during migration.

A denial is permanent for that queued job; callers must create/update the governed flow and enqueue a new executable job rather than relying on retries to bypass authority.

## Durable flow state

The database now persists `foundry_flows` independently of jobs and records an append-only `foundry_flow_transitions` history. This makes authority state auditable before, during and after runtime execution.

A HIL flow follows the controlled path:

`awaiting_approval -> approve_foundry_flow() -> ready -> executing -> verifying/completed`.

Approval clears `approval_required`, records `approved_by/approved_at`, appends a transition, and emits `flow.approved`. Invalid lifecycle transitions and approval of blocked/non-pending flows fail closed. The durable record can link the existing `decision_id`, `intervention_id`, and `job_id` rather than duplicating those domain objects.

## Capability OS boundary

Kernel-aware execution resolves the declared capability before a handler runs. Internal compute/workflow capabilities are always locally available; external capabilities resolve against their real configuration/provider state. Unknown capability kinds are permanent contract failures. Temporarily unavailable configured services are retryable and therefore use the existing queue backoff rather than being reported as successful.

Completion also validates capability-specific evidence. Messaging requires a provider plus provider message ID; webhook egress requires a delivery ID plus HTTP status; payments/FX use their domain evidence. Provider adapters remain authoritative for vendor-specific safety and permanent-error classification (for example approved WhatsApp templates and SSRF-safe webhook egress).
