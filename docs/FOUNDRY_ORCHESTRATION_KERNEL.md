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
