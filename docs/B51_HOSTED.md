# B51 Hosted production activation

## Hosted resources

| Resource | Value | State |
| --- | --- | --- |
| Supabase project | `Foundry` · ref `qkuradblfrqebtfetyct` · eu-west-2 (London) · Postgres 17 | Created 2026-10-01 on the **Free** plan |
| API URL | `https://qkuradblfrqebtfetyct.supabase.co` | Live |
| Vercel project | `foundry` · `prj_GuTGP9RLUkaXcBwWvCjDRlTtB8eI` (Eduradius LLC) · https://foundry-iota-eight.vercel.app | Created by the owner. The only deployment (READY) builds `main` @ `9c8eddc` ("first commit": `README.md` only), **not the Foundry app**. Foundry is on PR #1 and is live only after a merge to `main` |

## Database: built only from the repo migration chain

1. **Starting point.** The project was empty: no app schema, no migration history.
2. **Applying the chain.** No CLI access token was available, and the container can't reach `*.supabase.co`. So the database fetched each migration itself, in order, from `raw.githubusercontent.com` at the pinned commit `795401f`.
   - Before running each file, it checked the file's MD5 against the repo copy.
   - Each file ran in its own atomic step and was recorded in `supabase_migrations.schema_migrations` under its repo version, with the same history the CLI keeps.
   - The temporary helper functions and the `http` extension were dropped afterwards.
3. **`20260930004500_search_path_hygiene`** was applied afterwards from the repo; its history entry's MD5 matches the file.
4. **Drift check against local.**
   - Counts match: 116 tables, 1,138 columns, 141 policies, 329 functions.
   - Function, policy and column definition hashes are identical: **no drift**.
5. **Seed not applied.** `supabase/seed.sql` (local only: demo data, `dual_approval=false`, `environment=local`) was **not** applied.

## Security verification (hosted)

**Foundry's own checks:**
- `security_report()` is clean: no anon table grants, no tables without RLS, no unindexed `business_id`, no definer functions callable by `anon`, no definer functions without a pinned `search_path`.
- `integrity_report()` reports all zeros.
- `anon` has no usage on the `private` schema.

**Supabase advisors, after the fixes:**
- **163 × "signed-in users can execute SECURITY DEFINER" (WARN): by design.** These RPCs are the API, and each checks authorization inside (covered by pgTAP).
- **6 × RLS on with no policy (INFO): by design.** They are deny-all, server-only tables: `idempotency_keys`, `integration_calls`, `service_identities`, `stripe_events`, `webhook_deliveries`, `webhook_subscriptions`.
- **4 × mutable `search_path` (WARN): fixed** by `20260930004500`.
- **Performance (P3 backlog):**
  - 111 unindexed foreign keys and 5 multiple-permissive-policy notices. Neither matters at pilot scale.
  - The "unused index" notices are meaningless on an empty database.

## Test vs real data (hosted, rolled-back check)

The check ran inside a block that always rolls back, so nothing persisted:
- With `environment` unset, a new business is classed `test`.
- The evidence register refuses test data.
- A business can't be promoted to real outside production.
- With `environment = production`, a new business is classed `real`.

Then `platform_settings.environment = "production"` was set (2026-10-01 05:15 UTC). `dual_approval = true`.

> **Hosted smoke accounts.** From now on every business created on hosted is classed `real`. A smoke or golden-path test business must be demoted right after creation (`set_business_data_class(id, 'test', 'B51 smoke')`) so it can never become evidence. Evidence also needs consent, and is only harvested daily.

## Vercel configuration (2026-10-01)

- **Production environment variables, all non-secret** and scoped to *production only*. Previews must never point at the production database, or test traffic would become real businesses:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the public, RLS-protected key)
  - `NEXT_PUBLIC_SITE_URL=https://foundry-iota-eight.vercel.app`
  - `APP_ENV=production`
- **Fails closed until the secrets are added in the dashboard.** Because `APP_ENV=production`, the server refuses to boot until these are present:
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `CRON_SECRET` (≥ 32 chars)
  - `PASSPORT_TOKEN_PEPPER` (≥ 32 chars)
  - `ANTHROPIC_API_KEY`
  - the provider groups

## Hosted migrations after B51

- `20260930004600`–`20260930004900` (B52–B60) were applied from the pinned commit `d40f69e`, with the same checksum-verified method.
- **Drift check:**
  - Both sides: 49 migrations, 121 tables, 1,207 columns, 147 policies, 356 functions.
  - Function, policy and column hashes are identical to a fresh local database: **no drift**.
- `security_report()` is clean.
- `market_proof_certification()` returns `INSUFFICIENT_EVIDENCE` (0 real businesses).

## Open B51 items

| Item | Status | Owner |
| --- | --- | --- |
| Job queue every minute: Vercel Hobby rejects `* * * * *`, so `vercel.json` is daily (queue 03:45 UTC). Before B52, move to Vercel Pro or an external minute scheduler (see RUNBOOK) | **P1 before B52** | You |
| Merge PR #1 to `main` so production builds Foundry (or set the production branch) | Pending | You |
| Domain/TLS, security headers, `/api/health` on the Foundry build | After merge + secrets | Me |
| Production secrets in Vercel (AI, messaging, payments, FX, internal, Supabase server key) | Pending | You, in the dashboard |
| Auth: email/OAuth is enough to deploy; SMS provider required before certifying phone OTP | Pending | You |
| Scheduled jobs (`/api/cron/jobs` every minute, `/api/cron/maintenance` daily) + webhooks registered at providers | After deploy | Me |
| Hosted smoke + golden path (signup → business → capture → Pulse → workflow → evidence) | After deploy | Me |
| Backups/recovery: Free plan has no downloadable daily backups and pauses idle projects | **Hard gate before B52**: upgrade to Pro; until then, manual `db dump` | You |
| Two platform admins on hosted | After first sign-ins | You + me |
