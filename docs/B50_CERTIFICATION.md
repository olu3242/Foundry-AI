# Foundry B50 certification

Branch `claude/loving-mccarthy-024pbq` · B41–B50 · run on a fresh local stack (Supabase Postgres 17, Next.js dev server, Chromium).

**Real-world status: INSUFFICIENT EVIDENCE.** Every business that exists today is test data: the platform has never run with `environment = "production"`, so `real_world_certification()` counts 0 real businesses. That is the correct result. Passing software tests cannot change it, and nothing in this report should be read as evidence about real businesses.

## 1. Technical certification

| Batch | Technical status | Evidence (all automated, against real persistence) |
| --- | --- | --- |
| B41 Production hardening | PASS | SSRF-safe egress (`safe-fetch.test.ts`, 18 tests); nonce CSP (`security.spec`); production refuses to boot on bad config (`config-check.test.ts`); dual approval (`39_hardening`, `security.spec`); job visibility and requeue |
| B42 Messaging rails | PASS | `40_messaging` (15); `messaging.spec` against a mock WhatsApp Cloud API: consent → send → signed receipt → STOP |
| B43 Payment rails | PASS | `41_payments` (20); `payments.spec` against a mock Paystack: checkout → verify → webhook replay → refund → reversal |
| B44 FX integrity | PASS | `42_fx_integrity` (13); `fx.spec` against a mock feed; market prices bill in local currency |
| B45 Pilot operations | PASS | `43_pilot_ops` (18); `pilots.spec`: configured pilot → code join → stage tracking; test data shown but never counted |
| B46–B49 Evidence | PASS (mechanism) | `44_real_world_evidence` (17); `evidence.spec`: the register refuses test data, missing consent, uncited or future-dated evidence |
| B50 Certification | PASS (mechanism) | `real_world_certification()` returns INSUFFICIENT EVIDENCE locally; a claim below its threshold returns FAILED; technical status is reported separately |

Totals for the final run:
- pgTAP: **559 assertions across 44 files**.
- Unit tests: **69**.
- Lint, typecheck, DB lint and production build: clean.
- **Playwright, 47 specs:** a single 30-minute serial run passed 43. The other 4 (`marketplace`, `pilot`, `scale`, `trust`) failed on dev-server connection resets and timeouts while I was changing the local database mid-run. All 4 passed on an immediate rerun, so it was not one clean pass.
- Security certification (`18_certification`) still passes with every new table: RLS on, no anon grants, pinned `search_path`, `business_id` indexed.

## 2. Real-world certification

`/admin/evidence` (and `real_world_certification()`) shows the status of each claim, against thresholds in `platform_settings.certification_thresholds`.

| Claim | Status | n (real) | Needed for PROVEN |
| --- | --- | --- | --- |
| Activation (B46) | INSUFFICIENT EVIDENCE | 0 | ≥ 20 real businesses, ≥ 50% activated |
| Verified outcomes (B47) | INSUFFICIENT EVIDENCE | 0 | ≥ 10 verified outcomes, ≥ 50% improved |
| Trust / Passport (B48) | INSUFFICIENT EVIDENCE | 0 | ≥ 10 third-party attestations across ≥ 5 businesses, ≥ 90% upheld |
| Commercial (B49) | INSUFFICIENT EVIDENCE | 0 | ≥ 10 paying businesses, ≥ 70% collection success |
| Distribution (B49) | INSUFFICIENT EVIDENCE | 0 | ≥ 20 acquisitions, ≥ 30% through programs or partners |
| Unit economics | INSUFFICIENT EVIDENCE | 0 | ≥ 10 paying, positive contribution, with reportable (fresh, sourced) FX |
| Data moat | INSUFFICIENT EVIDENCE | 0 | ≥ 30 complete chains: decision → intervention → verified outcome, in consenting businesses |

**Overall: INSUFFICIENT EVIDENCE.**

## 3. Actual unit economics

**None measured.** There is no real revenue, no real AI spend on real businesses, and the FX rates are still placeholders (`usd_reportable = false`).

The instrument is ready:

- **Formula:** contribution = USD-snapshot revenue − AI tokens × price − allocated infrastructure/operator cost.
- **Scope:** real businesses only, over the last 90 days.
- **Blank by design:** the claim stays blank until FX is reportable.

## 4. Verified outcome evidence

**None.** The evidence register contains 0 rows. Locally that's expected: the register refuses any row about a test business, and harvesting skips businesses that are not both real and consenting.

## 5. Operator leverage

**Not measured on real cohorts.** What can be measured today is the mechanism:

- Stages advance daily without a developer (`pilots.advance`).
- Stalled businesses escalate into the program's attention queue.
- Reminders reach owners on WhatsApp/SMS under their consent.
- Payment reconciliation runs hourly.

Real leverage means businesses served per operator-hour, plus how often escalations are resolved. Measuring it needs the pilot and recorded operator costs (`cost_inputs`).

## 6. Distribution evidence

**None real.** Acquisition channel is recorded for every business (`acquisition_attributions`) and harvested into B49 evidence when the business is real. Pilot invite → accept is matched by phone.

## 7. Data-moat evidence

**None real.** The complete-chain count (decision → intervention → verified outcome, network consent) is 0.

The data-layer controls from B37 still apply:

- businesses can opt out;
- groups smaller than 5 are never shown;
- every data use is tied to a purpose and has lineage.

## 8. Unresolved P0/P1 gaps

### P0: blocks a credible pilot claim

1. **No real cohort.** Setting up the first one takes four steps:
   - Deploy.
   - Set `environment = "production"` on the production database.
   - Create the sponsor organization, the program and the pilot.
   - Onboard businesses.
2. **Live provider accounts are needed:**
   - WhatsApp: approved Meta templates (`foundry_record_request`, `foundry_plan_reminder`, `foundry_payment_request`).
   - Africa's Talking: a sender ID.
   - Paystack: a live key with GHS/NGN mobile money enabled.
   - Open Exchange Rates (or similar): an API key, so USD totals become reportable.
3. **Market prices must be set:** the GHS or NGN Growth price (`/admin/fx`, needs a second admin). Until then, plans bill at the USD base price, which mobile money can't collect.
4. **`ANTHROPIC_API_KEY` in production.** Capture reading needs it, and production refuses to boot without it.

### P1: before scaling past the first cohort

- **Refunds need only one admin.** Payment refunds are admin-gated and audited, but not dual-approved.
- **Disputes and chargebacks** are recorded and raised as incidents, but not resolved automatically.
- **Messaging only covers some prompts.** B22 nudges and B31 pack workflow prompts are still in-app only; only the B23 routine-ops record requests and plan reminders reach WhatsApp/SMS.
- **Stage computation and harvesting loop per business in SQL.** That's fine for a cohort of about 200; it needs set-based workers beyond about 10k.
- **B26 scenarios still ignore the B37 opt-out** (carried over from B40).
- **E2E uses a phone-sized viewport without mobile emulation** (carried over from B40).

## 9. Commercial readiness

**Mechanically ready for a paid pilot; commercially unproven.** The mechanism is in place:

- **Charges:** charges are rated monthly at market prices. Businesses pay by mobile money or card through Paystack. Settlement links each provider transaction to revenue.
- **Problem payments:** refunds create reversals, and mismatches and double payments are held for a person.
- **Payers:** sponsors and partners can pay through the B21/B39 payer models.

What isn't proven:

- willingness to pay;
- collection success;
- sponsor renewal;
- CAC.

Each of these needs real payments in the register (B49).

## 10. Recommendation for the next phase

**Run one paid pilot and stop building features until it reports.**

**Pilot set-up:**
- **Market:** Ghana.
- **Vertical:** the fresh-produce pack.
- **Sponsor:** one sponsor organization (bank or NGO).
- **Program and pilot:**
  - a GHS market price;
  - cohort of about 200;
  - 90 days;
  - escalation after 5–7 quiet days;
  - success metrics: activation ≥ 0.6, verified outcomes ≥ 10, retention ≥ 0.5;
  - checkpoints at day 0, 30, 60 and 90.

**Go-live gate** (`docs/RUNBOOK.md`):
- `/api/health` config issues empty;
- `environment = "production"`;
- dual approval on, with two or more admins;
- all three rails configured, with webhooks registered;
- FX "USD reportable".

**During the pilot:** check `/pilots/[id]` and `/admin/evidence` weekly. Run `certify_real_world()` at each checkpoint; it runs daily anyway.

**Decision at day 90:** the claim statuses in §2, and nothing else, decide whether to scale, change the approach, or stop.
