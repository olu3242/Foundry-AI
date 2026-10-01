# B51 closure → B52–B60 live execution: status

No new features. From here, B52–B60 are run as operations, not coding batches.

## Status by track

| Batch | Technical | Hosted schema | Live execution | Real-world evidence |
| --- | --- | --- | --- | --- |
| B51 Hosted production | PASS (database) | PASS (49 migrations, no drift, security clean) | **NOT YET CERTIFIED**: Vercel production still builds `main` @ first commit | n/a |
| B52 Pilot launch | PASS | PASS | NOT YET CERTIFIED | INSUFFICIENT_EVIDENCE |
| B53 Operator field OS | PASS | PASS | NOT YET CERTIFIED | INSUFFICIENT_EVIDENCE |
| B54 Capture + data quality | PASS | PASS | NOT YET CERTIFIED | INSUFFICIENT_EVIDENCE |
| B55 Pulse calibration | PASS | PASS | NOT YET CERTIFIED | INSUFFICIENT_EVIDENCE |
| B56 Interventions | PASS | PASS | NOT YET CERTIFIED | INSUFFICIENT_EVIDENCE |
| B57 Verified outcomes | PASS | PASS | NOT YET CERTIFIED | INSUFFICIENT_EVIDENCE |
| B58 Commercial | PASS | PASS | NOT YET CERTIFIED | INSUFFICIENT_EVIDENCE |
| B59 Economics + retention | PASS | PASS | NOT YET CERTIFIED | INSUFFICIENT_EVIDENCE |
| B60 Market proof | PASS | PASS | NOT YET CERTIFIED | INSUFFICIENT_EVIDENCE (0 real businesses) |

Technical evidence: 622 pgTAP assertions across 48 files, 69 unit tests, `field-ops.spec` plus regressions, and green CI.

## Phase 1: close B51 (gate: PR #1 merged to `main`)

| # | Check | How it's verified (names only, never values) | Status |
| --- | --- | --- | --- |
| 1 | Production builds the merged Foundry commit | Vercel deployment `meta.githubCommitSha` = merge commit on `main` | Pending merge |
| 2 | Required env var **names** present (production only) | Vercel env listing, values never read. Present now: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`, `APP_ENV`. Missing: `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `PASSPORT_TOKEN_PEPPER`, `ANTHROPIC_API_KEY`, provider groups as used | Pending owner |
| 3 | Previews never use the production database | Preview target has no Supabase env (verified: none) | ✓ |
| 4 | Supabase Auth site URL and redirect URLs set to the production URL | Supabase dashboard → Auth → URL configuration (no connector tool for this; owner sets it, I verify through the sign-up flow) | Pending owner |
| 5 | `/api/health` → `ok`, `config.issues = []`, queue not overdue | HTTP check from the deployment (this container can't reach `*.vercel.app`; checked via Vercel runtime logs or by you) | Pending |
| 6 | TLS, CSP nonce, HSTS, `X-Frame-Options`, `nosniff` | Response headers of the production URL | Pending |
| 7 | Cron endpoint rejects requests without `CRON_SECRET` (401) and runs with it | Two calls to `/api/cron/jobs` | Pending |
| 8 | One controlled job run drains the queue | `jobs` table before and after (Supabase) | Pending |
| 9 | Hosted golden path: SIGNUP → BUSINESS → CAPTURE → PULSE → WORKFLOW → EVIDENCE | Dedicated smoke account; each business demoted right after creation with `set_business_data_class(id, 'test', 'B51 smoke')` | Pending |
| 10 | Smoke data excluded from real-world evidence, VEI, market proof, commercial proof and pilot economics | `real_world_certification()`, `market_proof_certification()`, `pilot_dashboard()` still show 0 real businesses; `evidence_register` is empty | Pending |

B51 is PASS only when rows 1–10 are ✓.

## Phase 2: gates before admitting real businesses (B52)

| Gate | Status |
| --- | --- |
| Production secrets complete (row 2) | Pending |
| Queue runs every minute: **Vercel Pro** (preferred) and restore `* * * * *` for `/api/cron/jobs` | P1, owner decision |
| Backup/recovery: Supabase Pro | P1, owner decision |
| Providers the pilot uses are operational (WhatsApp templates approved, SMS sender, Paystack live, FX key) | Pending |
| Owner-approved configuration: market, sponsor, vertical, cohort size, start/end, operator cost/hour, success metrics | **Owner decisions** |

## Phase 3: operate B52–B59

Use the existing mechanisms only. Fix only P0 security or data-integrity issues, P1 pilot blockers, and friction that repeated pilot evidence shows is real. Everything else goes through the pilot gap loop into the backlog.

## Phase 4: B60

Run `market_proof_certification()` on real production evidence and report the fixed final form. Stop after B60; the next investment is chosen from observed pilot evidence. No B61–B70.
