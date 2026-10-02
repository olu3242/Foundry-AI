# Foundry compact gap implementation — 2026-10-02

This register supersedes stale gap statements in earlier certification notes. It separates code gaps from hosted/real-world evidence gates.

## Closed in B41–B45 and present on main

- CSP nonce strategy and security headers.
- SSRF-safe outbound egress with connect-time DNS/private-address checks and no redirects.
- Four-eyes change approval for sensitive policy/pack/market operations.
- WhatsApp Cloud API and Africa's Talking SMS delivery, consent, quiet hours, receipts and STOP handling.
- Paystack payment collection/reconciliation.
- External FX refresh with reportability/integrity controls.

## Closed by this branch

1. **Forecast network-consent boundary.** Intervention scenario forecasts now recompute cross-business evidence using only businesses with `data_sharing = 'network'`. The persisted input digest, confidence, result, basis and method version are regenerated from the consented cohort.
2. **Experiment sample-size planning.** Admin experiment creation now has a deterministic two-proportion planning helper. It estimates completed plans per arm from baseline rate and minimum detectable lift at 80% power / 5% two-sided significance. The admin can still choose the final minimum.

## Remaining code/scale backlog

- Partition or set-base per-business daily scans before scale materially exceeds pilot/early-market volume.
- Extend experimentation beyond `solution_variant` only when a second safe surface has a concrete product need.
- Improve expected-value priors as verified outcome volume grows; do not promote sparse correlations into autonomous policy.
- Automate sponsor non-payment handling if sponsor billing volume makes manual operations insufficient.
- Continue i18n coverage beyond the current shell/capture surfaces.
- Upgrade dependency debt when framework compatibility permits.
- Improve E2E mobile emulation/visual interaction robustness.

## Operational gates — not missing application code

- Production secrets/provider credentials must be configured without exposing values.
- Production deployment, cron cadence and provider webhooks must be live.
- Backup/recovery tier must satisfy the pilot operating requirement.
- Provider accounts/templates/senders must be approved and operational.
- Hosted golden path must pass against a smoke business excluded from real-world evidence.
- Real pilot cohort must generate sufficient longitudinal evidence before market/ROI/moat claims are upgraded.

## Canonical implementation priority

Do not start another broad feature wave merely because an older document lists a gap. Re-audit current code first. Prioritize:

1. hosted production certification;
2. real pilot execution;
3. defects or friction observed in pilot evidence;
4. scale work only when measured load requires it.

The product already contains the business-record, intelligence, decision, intervention, messaging, payments, outcome, memory, governance and certification mechanisms. The principal remaining constraint is production operation and real-world evidence, not another speculative architecture layer.
