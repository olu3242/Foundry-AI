# Foundry B40 certification

Branch `claude/loving-mccarthy-024pbq` · B1–B40 · certification run on a fresh local stack (Supabase Postgres 17, Next.js dev server, Chromium).

## 1. Verdict

| Layer | Status | Evidence |
| --- | --- | --- |
| Mechanisms (B21–B40) | **PASS** | Every batch has a migration, a pgTAP suite (positive and negative paths, against real persistence) and at least one Playwright E2E through the UI |
| Security certification | **PASS** | `18_certification`: RLS on every table, no anon grants, no anon-callable definer functions, pinned `search_path`, every `business_id` indexed (re-checked after all B21–B40 tables) |
| Closed loop on live data | **PENDING_EVIDENCE** | `moat_certification()` evaluates each link from live data. On local demo data most links read `insufficient_evidence`, which is correct. The loop can only pass on a real pilot cohort (§6) |

Test totals for the final run: **464 pgTAP assertions (38 files) pass**, plus 38 unit tests, lint and typecheck. The E2E count is in the PR description.

## 2. Closed-loop links and where each is proven

| Link | Mechanism (batch → test) | Live evidence |
| --- | --- | --- |
| MORE BUSINESSES | Distribution, attribution, API invites (B15/B27 → `13_distribution`, `25_api_platform`, `api.spec`) | New businesses in this period vs the previous one |
| → MORE TRUSTED RECORDS | Capture → confirm (B5), verification (B8/B24 → `22_trust_network`, `trust.spec`), quality (B25 → `23_data_quality`, `quality.spec`) | Record volume and the share of records backed by proof, trending up |
| → BETTER INTELLIGENCE | Pulse, forecasts and backtests, drift (B7/B26/B38 → `24_forecasting`, `36_intelligence_quality`, `outlook.spec`) | Forecast interval coverage ≥ 70%, Pulse precision ≥ 60%, no drift alerts |
| → BETTER DECISIONS | Decision objects with replay (B33 → `31_decision_engine`, `decisions.spec`) | Improvement rate when the recommendation is accepted ≥ when it is overridden (needs at least 30 decisions) |
| → BETTER SOLUTIONS | Effectiveness, experiments, playbooks (B13/B29/B34 → `27_experimentation`, `32_playbooks`, `experiments.spec`, `playbooks.spec`) | Verified improvement rate; concluded experiments |
| → VERIFIED OUTCOMES | Outcomes verified only by partners or verifiers (B11/B24 → `09_pilot`, `pilot.spec`) | At least 10 verified improvements in the period |
| → STRONGER DISTRIBUTION | Programs, partners, orgs, sponsorship (B15/B21/B36/B39 → `37_enterprise_control`, `enterprise.spec`) | At least 30% of acquisitions come through programs or partners (needs at least 20 acquisitions) |

## 3. Commercialization evidence (B21, B35, B39)

- **Traceable revenue.** Every revenue row traces customer → product → entitlement → usage → billable event → revenue (`commercial_trace`). Proven in `19_commercial` and `commercial.spec`.
- **Payer models without code forks.**
  - Business-paid plans.
  - Sponsor-paid plans (programs, and organizations through `org_sponsor_plan`).
  - Partner-paid plans.
  - Provider solution fees with a take rate, and success fees on verified results.
  - Dunning for unpaid purchases.
- **Channel economics.** Acquisition → activation → retention → verified outcome → revenue − AI cost − allocated cost. CAC and payback appear only with recorded acquisition-cost evidence (`33_channel_economics`, `channels.spec`).

## 4. Data and intelligence moat evidence

The valuable unit is business context + problem + decision + intervention + evidence + outcome. It is materialised as one linked chain:

- Pulse signal (problem, B7) leads to a decision object (options, evidence, risk, authority, B33).
- The decision leads to a chosen intervention (B11/B34), whose outcome (B11) carries an evidence layer (observed or verified, B24).
- Business memory (B32) holds the longitudinal context; B37 aggregates it with consent.

Each property has a proof:

| Property | Proof |
| --- | --- |
| Provenance and verification | Attestations per claim with minimum evidence, disputes and corrections (`22_trust_network`) |
| Longitudinal history | Memory timeline labelled verified, confirmed, observed, derived or inferred (`30_business_memory`) |
| Intervention and outcome linkage | `decisions.result`, `playbook_runs.result`, `intervention_outcomes` dataset |
| Quality | Completeness, consistency, recency, provenance and verification, where unknown stays unknown (`23_data_quality`) |
| Permissioned reuse | Owner opt-out; purpose-bound reads with a refusal log; minimum group size 5; lineage SOURCE → TRANSFORMATION → FEATURE → USE (`35_data_layer`, `data-layer.spec`) |
| Intelligence quality | Forecast backtests, Pulse precision and false positives, decision quality, drift (`36_intelligence_quality`) |

## 5. Unit-economics evidence

- **Cost per business is computed from real inputs:**
  - AI tokens × model price (`agent_runs` × `ai_prices`).
  - Infrastructure and operator costs (`cost_inputs`), allocated by active businesses and labelled "allocated".
- **Revenue is grouped by payer** (business, program, provider) via `billable_events`.
- **Contribution** = revenue − AI cost − allocated cost (`scale_metrics`, `channel_economics`, `moat_certification.economics`).
- **Local values are demo data.** No unit-economics claim should be made until §6 runs on a pilot.

## 6. Remaining gaps

### P0: needed before external claims or paying customers

1. **Real-cohort evidence.** Closing the loop needs a deployed environment, `ANTHROPIC_API_KEY`, a real sponsor program and about 200 businesses for 90 days. Until then `moat_certification().loop_status = PENDING_EVIDENCE`.
2. **Payment collection rails.** Settlement is manual (mobile money, bank or cash reference) or Stripe invoice metadata. There is no Paystack, Flutterwave or M-Pesa collection yet.
3. **Outbound delivery channel.** B23 reminders, B22 nudges and B31 workflow prompts are in-app only. Owners who rarely open the app need SMS or WhatsApp delivery, through the same authority and audit path.
4. **Webhook egress hardening.** Live webhooks require https, but there is no private-IP or DNS-rebinding guard yet.
5. **FX rates** are indicative seeds. Connect a rate feed before reporting USD externally.

### P1: needed for scale or robustness

- **Daily scans are per-business loops in SQL.** This covers retention, data quality, routine ops, forecasts, memory refresh and certification. It is fine to roughly 10k businesses; beyond that it needs set-based or partitioned workers.
- **B26 intervention scenarios ignore opt-out.** They read cross-business solution stats inline without the B37 opt-out filter (ranking, benchmarks and datasets do apply it).
- **Policy, pack and dataset changes go live with a single admin action.** Add four-eyes approval for policy activation.
- **Experiments have no sample-size planner** and support only one surface (`solution_variant`).
- **Decision expected values rest on priors early on**, because verified outcomes are sparse. Options are rules-generated by design; LLM-proposed options would need the same evidence and replay contract.
- **Sponsor non-payment handling is manual** (dunning covers business purchases only).
- **New B21–B40 screens are English only**, and there is no CSP header.
- **E2E runs a phone-sized viewport without mobile emulation** (the visual-viewport offset breaks coordinate clicks).

## 7. Recommended next investment

**A paid pilot in one market and one vertical:**

- Market: Ghana or Nigeria.
- Vertical: fresh-produce pack (B31).
- Sponsor: one bank or NGO organization (B39) sponsoring a plan (B21).
- Distribution: about 200 businesses through program codes and partners (B15/B36).

Pair it with mobile-money collection and WhatsApp/SMS delivery (P0 items 2 and 3). All mechanisms already exist and are tested. The constraint now is verified outcomes from real businesses: that is what moves every loop link from `insufficient_evidence` to `evidenced`, and it is the evidence investors and lenders will ask for. Do not build B41+ features before this pilot reports.
