# Foundry AI

The AI-native business operating system for small and informal businesses in Africa.

> Build the business behind the business. Run better. Sell more. Keep more. Prove it. Grow.

A business owner says, types or photographs what happened ("sold 2 bags of rice at 45k to Mama Bisi, cash"). Foundry drafts the record, the owner confirms it, and the books, **Pulse**, **Passport** and **Market** update from there. Nothing reaches the books, and no customer is messaged, without a person.

## Stack

Next.js 15 (App Router, server actions) · TypeScript (strict) · Tailwind + shadcn-style primitives · Supabase (Postgres, RLS, Auth, Storage) · Claude (structured-output extraction) · Stripe (program billing) · Sentry (optional) · Vercel (hosting and cron).

## What's in the box

| Area | Where | Notes |
| --- | --- | --- |
| Multi-tenant core | `supabase/migrations/…0100_tenancy.sql` | Businesses, memberships (owner/staff/partner/program_admin), RLS helpers in the `private` schema |
| Auth and onboarding | `app/(auth)`, `app/onboarding`, `middleware.ts` | Phone OTP first, email magic link second |
| Backbone | `…0200_backbone.sql`, `lib/jobs`, `lib/telemetry.ts` | Append-only events, row audit log, durable job queue (dedupe, backoff, dead-letter), idempotency keys, rate limits |
| Capture → Confirm | `…0300_capture.sql`, `lib/ai`, `lib/capture` | Text, voice (on-device speech-to-text) and photo; Claude drafts records with confidence and evidence; `confirm_draft` writes the books |
| Books and offline | `…0400_workspace.sql`, `app/b/[bid]/records`, `public/sw.js`, `lib/offline` | One write path (`private.write_record`), voiding not deleting, IndexedDB outbox and service worker |
| Pulse | `…0500_pulse.sql`, `lib/pulse` | Nine explainable signals (score, state, trend, why, next step); says "not enough data" rather than guessing |
| Passport | `…0600_passport.sql`, `lib/passport`, `app/p/[token]` | Verification ladder, revocable share links with hashed tokens, view logging. Not a credit score |
| Market, Growth, autonomy | `…0700_market_autonomy.sql`, `lib/market`, `lib/growth`, `lib/autonomy` | Autonomy levels L0–L5 per action, inbox of agent actions, WhatsApp-ready reminders, explainable matching |
| Programs and partners | `…0800_programs.sql`, `app/programs`, `app/partner` | Join by code with explicit consent; leaving revokes access immediately; Stripe seats |

Extensions B11–B20 build on the above (each migration's header lists what it reuses):

| Batch | Where | Adds |
| --- | --- | --- |
| B11 Pilot activation | `…0900_pilot.sql`, `app/b/[bid]/progress` | Baselines on joining, activation milestones, Pulse feedback, plans (interventions) with measured outcomes that only a partner or program can verify; verified results appear on the Passport |
| B12 Operator scale | `…1000_operator.sql`, `app/partner` | Exception queue across a portfolio, snoozes, resolution tracking, workload metrics, safe batch nudges, daily brief |
| B13 Solution effectiveness | `…1100_solutions.sql`, `app/admin/solutions` | Versioned solution catalogue; per-version funnel (activated → completed → improved → verified), failure reasons, deprecation |
| B14 Benchmarking | `…1200_benchmarks.sql` | Cohorts (country/sector/activity), minimum sample 10, quality-weighted, confidence; no rankings |
| B15 Distribution | `…1300_distribution.sql`, `app/join/[code]` | Program builder, bulk invites, first-touch attribution (partner-sourced), aggregate sponsor report + CSV, consent visibility |
| B16 Financial opportunity | `…1400_finance.sql`, `app/b/[bid]/finance` | Partner-defined eligibility (pass/fail per rule, never a score), consented frozen evidence packages with SHA-256, decisions, withdrawal |
| B17 Solution marketplace | `…1500_marketplace.sql`, `app/providers` | Provider onboarding, submit → review → live, pricing metadata, consented provider-led engagements, progress updates |
| B18 Network learning | `…1600_learning.sql`, `app/admin/learning` | Model/prompt lineage, recommendation → outcome evaluation, extraction edit rates, Pulse calibration, drift snapshots, evidence-ranked solutions |
| B19 Multi-market | `…1700_markets.sql`, `app/admin/markets` | Markets as configuration: currency, timezone, language, identifiers, jurisdiction, connectors, data residency; en/fr UI |
| B20 Scale + funding readiness | `…1800_scale.sql`, `app/admin/scale`, `/api/admin/evidence` | Product/ops/solutions/economics/impact (VEI)/distribution/data-moat metrics, cohort retention, cost inputs, security + integrity certification, evidence pack |

Extensions B21–B40 add commercial, operating, intelligence and moat layers on the same primitives:

| Batch | Where | Adds |
| --- | --- | --- |
| B21 Commercialization | `…1900_commercial.sql`, `app/b/[bid]/plan`, `app/admin/commercial` | Plans, entitlements (business / sponsor / partner payers), metered usage, billable events, settlement (manual rails + Stripe), revenue trace |
| B22 Retention | `…2000_retention.sql`, `app/admin/retention` | Value-based health, risk + continuation, evidence-backed recovery actions in the operator queue, recovery rate |
| B23 Autonomous operations | `…2100_autonomous_ops.sql` | Record requests, plan reminders, verification routing under A0–A5 authority; escalations; reversible auto-routing |
| B24 Trust network | `…2200_trust_network.sql`, `app/verify`, `app/admin/trust` | Approved verifiers attest to specific claims with minimum, time-boxed evidence; disputes, corrections, history; no blanket trust |
| B25 Data quality | `…2300_data_quality.sql`, `app/b/[bid]/quality` | Duplicate / conflict / gap / staleness detection, reconciliation, correction lineage, quality dimensions (unknown stays unknown) |
| B26 Forecasting | `…2400_forecasting.sql`, `app/b/[bid]/outlook` | Reproducible outlooks (sales, cash pressure, stock, collections, plan scenarios) with basis, interval, assumptions, confidence |
| B27 API platform | `…2500_api_platform.sql`, `app/api/v1` | Versioned API, hashed scoped keys, signed webhooks with retries, sandbox programs, per-key rate limits, call audit |
| B28 Policy engine | `…2600_policy_engine.sql`, `app/admin/policies` | Versioned layered policies (global → market → organization → program → provider → solution), decision log |
| B29 Experimentation | `…2700_experimentation.sql`, `app/admin/experiments` | Randomized sticky assignment of solution variants, CI + p-value, guardrails, termination, history; finance/legal protected |
| B30 Scale OS | `…2800_control_plane.sql`, `app/admin/control` | Control plane across all areas, incidents from live signals, required interventions |
| B31 Vertical packs | `…2900_vertical_packs.sql`, `app/b/[bid]/pack/[key]`, `app/admin/packs` | Verticals as configuration (entities, metrics, Pulse rules, solutions, workflows); first pack: fresh produce |
| B32 Business memory | `…3000_business_memory.sql`, `app/b/[bid]/memory` | Longitudinal timeline labelled verified / confirmed / observed / derived / inferred; history in recommendations |
| B33 Decision engine | `…3100_decision_engine.sql`, `app/b/[bid]/decisions` | Signal → options → evidence → risk → expected value → authority → decision → result, replayable |
| B34 Playbooks | `…3200_playbooks.sql` | Multi-solution playbooks launched from detected problems; governed steps; playbook outcome |
| B35 Distribution economics | `…3300_channel_economics.sql`, `app/admin/channels` | Channel funnel to revenue/cost; CAC and payback only with acquisition-cost evidence |
| B36 Partner performance | `…3400_partner_performance.sql`, `app/admin/partners` | Partner, provider and verifier metrics for governance; documented routing score |
| B37 Data layer | `…3500_data_layer.sql`, `app/admin/data` | Consented, purpose-bound derived datasets with SOURCE → TRANSFORMATION → FEATURE → USE lineage; owner opt-out |
| B38 Intelligence quality | `…3600_intelligence_quality.sql`, `app/admin/intelligence` | Forecast backtests, Pulse precision, decision quality, drift across all intelligence |
| B39 Enterprise control | `…3700_enterprise_control.sql`, `app/orgs` | Organizations over many programs, delegated admins, org sponsorship + policy, aggregated reporting, SLA telemetry |
| B40 Certification | `…3800_moat_certification.sql`, `app/admin/certification`, `docs/B40_CERTIFICATION.md` | Moat dimensions + closed-loop evidence check |

Platform admins (solution review, learning, markets, scale) are granted in SQL: `insert into platform_admins (user_id) values ('<uuid>');`

## Local development

Requires Node 20+, Docker, and the Supabase CLI (installed as a dev dependency).

```bash
npm install
cp .env.example .env.local           # then fill in the values printed by the next command
SUPABASE_AUTH_SMS_TWILIO_AUTH_TOKEN=local-dev npm run db:start
npm run db:reset                     # applies migrations and supabase/seed.sql
npm run dev                          # http://localhost:3000
```

Sign in with a test phone number from `supabase/config.toml` (`[auth.sms.test_otp]`, for example `+233 20 000 0001`, code `123456`), or use email and open the magic link from the local mail catcher at http://127.0.0.1:54324.

Without `ANTHROPIC_API_KEY`, captures in development are read by a small rule-based parser (`lib/ai/heuristic.ts`) so the whole loop can be exercised. In production, captures without a key are marked "enter by hand".

The job worker runs from `/api/cron/jobs`. Locally, captures and Pulse refreshes run inline; to drain everything else:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/jobs
```

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Supabase project |
| `NEXT_PUBLIC_SITE_URL` | yes (prod) | Absolute links (magic links, share links, Stripe return URLs) |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Worker, webhooks, public share pages. Server only |
| `CRON_SECRET` | yes | Bearer token for `/api/cron/*` (Vercel Cron sends it). 16+ characters |
| `PASSPORT_TOKEN_PEPPER` | yes | HMAC pepper for share tokens. Rotating it invalidates every share link |
| `ANTHROPIC_API_KEY`, `AI_EXTRACTION_MODEL` | recommended | Capture extraction (default model `claude-opus-5-5`, low effort, refusal fallback on) |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PROGRAM_PRICE_ID` | optional | Program seats; without them programs run on 5 free pilot seats |
| `NEXT_PUBLIC_SENTRY_DSN` | optional | Error reporting (no request bodies, headers, cookies or user info are sent) |

Server variables are validated with zod on first use (`lib/env.ts`), so `next build` doesn't need secrets.

## Tests

```bash
npm run check        # eslint + tsc + vitest (pure logic: money, dates, pulse, matching, autonomy, extraction mapping)
npm run db:test      # pgTAP: 464 assertions incl. security/performance certification (RLS everywhere, no anon access, pinned search_path, business_id indexes)
npm run e2e          # Playwright against the local stack (set PW_CHROMIUM_PATH to use a preinstalled Chromium)
```

CI (`.github/workflows/ci.yml`) runs lint, typecheck, unit tests and a production build, plus a database job that runs `supabase db lint` and the pgTAP suite.

## Deploying

1. **Supabase**: create a project, `supabase link`, then `supabase db push`. Enable phone auth with your SMS provider (Twilio, MessageBird, Vonage or Termii for West Africa) and set the site URL and redirect URL (`https://<domain>/auth/callback`).
2. **Vercel**: import the repo, set the environment variables above, and deploy. `vercel.json` schedules the job worker every minute and maintenance daily (per-minute cron needs a Pro plan; on Hobby, point an external scheduler at `/api/cron/jobs`).
3. **Stripe** (when programs go live): create a recurring per-seat price and set `STRIPE_PROGRAM_PRICE_ID`. Add a webhook to `https://<domain>/api/webhooks/stripe` for `checkout.session.completed` and `customer.subscription.*`.
4. **Monitoring**: point an uptime check at `/api/health`. It returns 503 when jobs are overdue by more than 10 minutes and reports dead jobs from the last 24 hours.

## Operations runbook

- **Queue backed up** (`/api/health` → `overdue_10m > 0`): check that the cron is firing and that `CRON_SECRET` matches. Workers that crash leave jobs `running`; `reap_stale_jobs()` puts them back on the next tick.
- **Dead jobs**: `select type, last_error, payload from jobs where status = 'dead' order by finished_at desc;`. Each dead job also emits a `job.dead` event in the business's activity feed. Fix the cause, then requeue with `update jobs set status = 'queued', attempts = 0, run_at = now() where id = …`.
- **AI outage**: extraction retries with backoff (4 attempts), then marks the capture "enter by hand". No data is lost; the capture text stays on the record.
- **Revoking access**: owners switch off share links from Passport; leaving a program ends program and partner access at once; removing a member is immediate. Everything is audited in `audit_log` and `events`.
- **Leaked share links**: rotate `PASSPORT_TOKEN_PEPPER` to invalidate all of them at once.

## Security model

- Every business-owned table has RLS. Reads go through `private.can_read` (membership or consented program access); writes to the books go through `private.can_write` (owner or staff).
- AI never writes to the books: drafts land in `record_drafts` (service role only) and become records through `confirm_draft`, which runs with the caller's permissions.
- Logs (`events`, `audit_log`, `agent_runs`, `jobs`) are written only by definer functions or the service role.
- Anonymous users can't read any table. Public share pages use the service role after verifying a hashed token.
- Money is stored as integers in the currency's minor unit (`lib/money.ts` handles zero-decimal currencies such as XOF and RWF).

## MVP shortcuts and known debt

- **Pilot proof.** The full loop (join → capture → confirm → Pulse → plan → outcome → partner verification → Passport) is proven end to end against a local stack with a test business and the dev extractor. Proving it with a real low-data business needs a deployed environment, an `ANTHROPIC_API_KEY`, and a real pilot cohort.
- **FX rates** in `fx_rates` are indicative seeds; connect a rate feed before reporting USD impact externally.
- **Benchmarks, matching and portfolio loading** iterate in SQL/TypeScript per business; fine for pilots, move to set-based jobs beyond a few thousand businesses.
- **i18n** covers the shell and capture in English and French; other strings are English. Adding a language is adding a catalogue.
- **Data residency** is enforced at business creation against `app.data_region` (`alter database postgres set app.data_region = 'af-south'`); running one deployment per region is an infrastructure step.

- **Voice** uses the browser's speech recognition, which needs Chrome/Android and a connection. Offline voice and server-side transcription (and local languages) are next.
- **Payment reminders** open WhatsApp for the owner to send; no automatic sending channel yet, so reminders are capped at L2 (draft for approval).
- **Market matching** loops over businesses in TypeScript. Move it to set-based SQL beyond a few thousand businesses.
- `private.can_read` runs per row; add indexes and consider caching program access once programs get large.
- Sentry source-map upload (the build plugin) isn't wired: errors are captured, but browser stack traces are minified.
- No CSP header yet; it needs a nonce strategy for Next.js inline scripts.
- Growth suggestions are rule-based (`rules-v1`) for explainability. Model-written coaching can layer on top through the same inbox and autonomy gates.
- Next.js bundles an older `postcss` flagged by `npm audit` (build-time only). Clears when upgrading Next.
- B21–B40 debt and gaps are tracked in `docs/B40_CERTIFICATION.md` (P0/P1 register).

## Design tokens

Defined as HSL variables in `app/globals.css` and mapped in `tailwind.config.ts`: Foundry Green `#006B3A` (brand, trust), Growth Green `#22C55E` (progress), Opportunity Gold `#F59E0B` (opportunities), Impact Orange `#F97316` (attention), Trust Navy `#0F204A` (institutional), Insight Purple `#805CF6` (AI moments only). Light and dark follow the system setting. Status is never shown by colour alone: each state has its own label and icon shape.

## License

Proprietary. © Foundry AI.
