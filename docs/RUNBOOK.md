# Foundry production runbook

## Before go-live (blocking)

- `GET /api/health` returns `"config": { "production": true, "issues": [] }`. The server refuses to boot in production (`APP_ENV=production` or `VERCEL_ENV=production`) if any of these are wrong:
  - required secrets
  - demo keys
  - http URLs
  - test overrides (`*_API_BASE`, `ALLOW_PRIVATE_EGRESS`)
  - incomplete provider credentials
  - non-live payment keys
- `platform_settings.dual_approval = true`. This is the default; it is turned off only by the local seed. Changing it needs an approved change request.
- Two or more platform admins exist, so changes can be approved.
- Supabase Auth phone provider is configured. Cron jobs (`/api/cron/jobs`, `/api/cron/maintenance`) are scheduled with `CRON_SECRET`.
- The messaging and payment provider webhooks point at the deployment (§ Rails).

## Severity and response

| Severity | Examples | Response |
| --- | --- | --- |
| SEV1 | Data exposure, wrong business data shown, payment double-charge, RLS or security check failing (`security_report`) | Page on-call now. Disable the affected rail or route; notify affected sponsors within 24h. |
| SEV2 | Captures not processing, queue overdue > 30 min, payments or messages failing broadly | On-call within 1h. Check `/admin/jobs` and `/admin/control`. |
| SEV3 | Single dead job type, drift alert, one partner SLA breach | Next business day |

## Where to look

- **`/admin/control`** shows incidents detected from live signals: dead jobs, failed webhooks, integrity, security, drift, policy-denial spikes, guardrail stops and overdue billing. Incidents resolve themselves when the signal clears.
- **`/admin/jobs`** shows retries and dead jobs with their last error. Requeueing is audited (`job.requeued` event).
- **`/admin/changes`** shows sensitive configuration changes awaiting a second admin. Approvals apply atomically, and failures keep their reason.
- **`/api/health`** reports uptime and queue state: `overdue_10m > 0` means the cron isn't firing or `CRON_SECRET` is wrong.

## Common procedures

- **Revoke an API key or webhook:** program page → API access → Revoke. Deliveries stop and the key is rejected immediately.
- **Stop all outbound messages:** set `MESSAGING_ENABLED=0` and redeploy. Queued messages are held, not dropped.
- **Stop payment collection:** remove `PAYSTACK_SECRET_KEY`. Existing charges stay open; webhooks for completed payments are still verified and reconciled.
- **Leaked Passport share links:** rotate `PASSPORT_TOKEN_PEPPER`. This invalidates every link at once.
- **Bad policy, pack or market:** file a change request to retire or replace it; a second admin approves.

## Outbound network

Every outbound call that a customer or configuration can influence (webhooks, providers) goes through `lib/net/safe-fetch.ts`:

- https only;
- no redirects;
- no credentials in URLs;
- private, loopback, link-local, CGNAT, metadata and reserved addresses blocked at connect time, which also defeats DNS rebinding.
