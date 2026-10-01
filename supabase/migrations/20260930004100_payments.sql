-- B43 Payment rails: online collection (Paystack: mobile money and card in Ghana/Nigeria) for
-- business-paid charges, on top of B21 billing. Provider truth stays with the provider; Foundry keeps
-- a traceable mirror: request → checkout → provider transaction → settlement (B21 revenue) →
-- refund/reversal → reconciliation. Amount or currency mismatches and double payments are never
-- settled silently: they are held for a person and raised as incidents.

create table public.payment_requests (
  id                       uuid primary key default gen_random_uuid(),
  business_id              uuid not null references public.businesses (id) on delete cascade,
  billable_event_id        uuid not null references public.billable_events (id) on delete cascade,
  provider                 text not null check (provider in ('paystack')),
  reference                text not null unique,              -- ours, sent to the provider
  amount_minor             bigint not null check (amount_minor > 0),
  currency                 text not null,
  status                   text not null default 'created' check (status in
                             ('created', 'pending', 'succeeded', 'failed', 'abandoned', 'mismatch', 'duplicate', 'refunded', 'partially_refunded', 'disputed')),
  checkout_url             text,
  access_code              text,
  provider_transaction_id  text unique,
  paid_amount_minor        bigint,
  paid_currency            text,
  payment_channel          text,                              -- as reported by the provider: mobile_money, card, bank…
  failure_reason           text,
  revenue_event_id         uuid references public.revenue_events (id) on delete set null,
  refunded_minor           bigint not null default 0,
  requested_by             uuid references public.profiles (id),
  created_at               timestamptz not null default now(),
  paid_at                  timestamptz,
  last_verified_at         timestamptz
);
create index payment_requests_business_idx on public.payment_requests (business_id, created_at desc);
create index payment_requests_billable_idx on public.payment_requests (billable_event_id);
create index payment_requests_open_idx on public.payment_requests (created_at) where status in ('created', 'pending');
create trigger payment_requests_audit after insert or update of status on public.payment_requests for each row execute function private.audit_row();

create table public.payment_events (
  id                  bigint generated always as identity primary key,
  payment_request_id  uuid references public.payment_requests (id) on delete cascade,
  business_id         uuid references public.businesses (id) on delete cascade,
  provider            text not null,
  provider_event_id   text unique,                           -- idempotency for webhooks and verifications
  kind                text not null check (kind in ('initialized', 'charge', 'verify', 'refund', 'dispute', 'unmatched')),
  status              text,
  detail              jsonb not null default '{}',
  created_at          timestamptz not null default now()
);
create index payment_events_request_idx on public.payment_events (payment_request_id);
create index payment_events_business_idx on public.payment_events (business_id);

create table public.payment_refunds (
  id                  uuid primary key default gen_random_uuid(),
  payment_request_id  uuid not null references public.payment_requests (id) on delete cascade,
  business_id         uuid not null references public.businesses (id) on delete cascade,
  provider_refund_id  text unique,
  amount_minor        bigint not null check (amount_minor > 0),
  currency            text not null,
  reason              text not null,
  status              text not null default 'requested' check (status in ('requested', 'pending', 'processed', 'failed')),
  revenue_event_id    uuid references public.revenue_events (id) on delete set null,
  requested_by        uuid references public.profiles (id),
  created_at          timestamptz not null default now(),
  processed_at        timestamptz
);
create index payment_refunds_request_idx on public.payment_refunds (payment_request_id);
create index payment_refunds_business_idx on public.payment_refunds (business_id);
create trigger payment_refunds_audit after insert or update of status on public.payment_refunds for each row execute function private.audit_row();

-- ─── Request ──────────────────────────────────────────────────────────────────
-- An owner or staff member starts paying an open business-paid charge. A still-open request for the
-- same charge is reused (no parallel checkouts for one charge).
create function public.create_payment_request(p_billable_event_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  b public.billable_events;
  r public.payment_requests;
begin
  select * into b from public.billable_events where id = p_billable_event_id;
  if not found or b.payer_kind <> 'business' or not private.has_role(b.business_id, array['owner', 'staff']::public.business_role[]) then
    raise exception 'Charge not found' using errcode = 'P0002';
  end if;
  if b.status <> 'open' then
    raise exception 'This charge is already %', b.status using errcode = 'P0001';
  end if;
  if b.amount_minor <= 0 then
    raise exception 'Nothing to pay on this charge' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.payment_requests where billable_event_id = b.id and status = 'succeeded') then
    raise exception 'A payment for this charge is already being settled' using errcode = 'P0001';
  end if;
  select * into r from public.payment_requests
  where billable_event_id = b.id and status in ('created', 'pending') and created_at > now() - interval '30 minutes'
  order by created_at desc limit 1;
  if not found then
    insert into public.payment_requests (business_id, billable_event_id, provider, reference, amount_minor, currency, requested_by)
    values (b.business_id, b.id, 'paystack', 'fdy_' || replace(gen_random_uuid()::text, '-', ''), b.amount_minor, b.currency, auth.uid())
    returning * into r;
  end if;
  return jsonb_build_object('id', r.id, 'reference', r.reference, 'amount_minor', r.amount_minor, 'currency', r.currency,
    'checkout_url', r.checkout_url, 'business_id', r.business_id, 'billable_event_id', r.billable_event_id,
    'email', (select email from public.profiles where id = auth.uid()), 'phone', (select phone from public.profiles where id = auth.uid()));
end $$;

create function public.record_payment_initialized(p_id uuid, p_access_code text, p_checkout_url text, p_error text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  r public.payment_requests;
begin
  select * into r from public.payment_requests where id = p_id for update;
  if not found then
    raise exception 'Payment request not found' using errcode = 'P0002';
  end if;
  if coalesce(p_error, '') <> '' then
    update public.payment_requests set status = 'failed', failure_reason = left(p_error, 500) where id = p_id and status in ('created', 'pending');
    insert into public.payment_events (payment_request_id, business_id, provider, kind, status, detail)
    values (p_id, r.business_id, r.provider, 'initialized', 'failed', jsonb_build_object('error', left(p_error, 500)));
    return;
  end if;
  update public.payment_requests set status = 'pending', access_code = p_access_code, checkout_url = p_checkout_url
  where id = p_id and status in ('created', 'pending');
  insert into public.payment_events (payment_request_id, business_id, provider, kind, status)
  values (p_id, r.business_id, r.provider, 'initialized', 'pending');
end $$;

-- ─── Result (webhook or verification) ─────────────────────────────────────────
-- Idempotent per provider event. Success settles the B21 charge only when amount and currency match
-- the request and the charge is still open; anything else is held for a person.
create function public.apply_payment_result(
  p_reference text, p_status text, p_transaction_id text, p_amount_minor bigint, p_currency text,
  p_channel text, p_paid_at timestamptz, p_event_id text, p_kind text, p_detail jsonb
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  r public.payment_requests;
  b public.billable_events;
  rid uuid;
  method text;
begin
  if p_status not in ('success', 'failed', 'abandoned', 'pending') or p_kind not in ('charge', 'verify') then
    raise exception 'Unsupported payment status' using errcode = '22023';
  end if;
  select * into r from public.payment_requests where reference = p_reference for update;
  if not found then
    insert into public.payment_events (provider, provider_event_id, kind, status, detail)
    values ('paystack', p_event_id, 'unmatched', p_status, coalesce(p_detail, '{}') || jsonb_build_object('reference', p_reference))
    on conflict (provider_event_id) do nothing;
    return 'unmatched';
  end if;
  insert into public.payment_events (payment_request_id, business_id, provider, provider_event_id, kind, status, detail)
  values (r.id, r.business_id, r.provider, p_event_id, p_kind, p_status,
          coalesce(p_detail, '{}') || jsonb_build_object('transaction_id', p_transaction_id, 'amount_minor', p_amount_minor, 'currency', p_currency, 'channel', p_channel))
  on conflict (provider_event_id) do nothing;
  if not found then
    return 'duplicate_event';
  end if;
  update public.payment_requests set last_verified_at = now() where id = r.id;

  if r.status in ('succeeded', 'mismatch', 'duplicate', 'refunded', 'partially_refunded', 'disputed') then
    return r.status;                                          -- terminal for this rail; later events are history only
  end if;
  if p_status = 'pending' then
    return r.status;
  end if;
  if p_status in ('failed', 'abandoned') then
    update public.payment_requests set status = p_status, failure_reason = coalesce(p_detail ->> 'gateway_response', p_status),
      provider_transaction_id = coalesce(provider_transaction_id, nullif(p_transaction_id, ''))
    where id = r.id;
    perform private.emit_event(r.business_id, 'payment.failed', 'payment_request', r.id, jsonb_build_object('status', p_status, 'reference', r.reference));
    return p_status;
  end if;

  -- success
  if p_amount_minor is distinct from r.amount_minor or upper(coalesce(p_currency, '')) <> upper(r.currency) then
    update public.payment_requests set status = 'mismatch', provider_transaction_id = p_transaction_id, paid_amount_minor = p_amount_minor,
      paid_currency = p_currency, payment_channel = p_channel, paid_at = coalesce(p_paid_at, now()),
      failure_reason = format('Paid %s %s, expected %s %s', p_amount_minor, p_currency, r.amount_minor, r.currency)
    where id = r.id;
    perform private.emit_event(r.business_id, 'payment.mismatch', 'payment_request', r.id, jsonb_build_object('reference', r.reference));
    return 'mismatch';
  end if;
  select * into b from public.billable_events where id = r.billable_event_id for update;
  if b.status <> 'open' then
    -- Paid twice (e.g. manual mobile-money reference recorded first): keep both truths, refund by hand.
    update public.payment_requests set status = 'duplicate', provider_transaction_id = p_transaction_id, paid_amount_minor = p_amount_minor,
      paid_currency = p_currency, payment_channel = p_channel, paid_at = coalesce(p_paid_at, now()),
      failure_reason = 'Charge was already ' || b.status || ' when this payment succeeded'
    where id = r.id;
    perform private.emit_event(r.business_id, 'payment.duplicate', 'payment_request', r.id, jsonb_build_object('reference', r.reference));
    return 'duplicate';
  end if;
  method := case when p_channel in ('mobile_money', 'card', 'bank_transfer') then p_channel when p_channel in ('bank', 'ussd', 'qr') then 'bank_transfer' else 'card' end;
  rid := public.settle_billable_event(b.id, method, 'paystack:' || p_transaction_id);
  update public.payment_requests set status = 'succeeded', provider_transaction_id = p_transaction_id, paid_amount_minor = p_amount_minor,
    paid_currency = p_currency, payment_channel = p_channel, paid_at = coalesce(p_paid_at, now()), revenue_event_id = rid, failure_reason = null
  where id = r.id;
  perform private.emit_event(r.business_id, 'payment.succeeded', 'payment_request', r.id,
    jsonb_build_object('reference', r.reference, 'transaction_id', p_transaction_id, 'channel', p_channel, 'revenue_event_id', rid));
  return 'succeeded';
end $$;

-- ─── Refunds and reversals ────────────────────────────────────────────────────
create function public.request_payment_refund(p_payment_request_id uuid, p_amount_minor bigint, p_reason text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  r public.payment_requests;
  fid uuid;
  pending_minor bigint;
begin
  if not private.is_platform_admin() then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
  if char_length(coalesce(trim(p_reason), '')) < 5 then
    raise exception 'Give the reason for the refund' using errcode = '22023';
  end if;
  select * into r from public.payment_requests where id = p_payment_request_id for update;
  if not found or r.status not in ('succeeded', 'partially_refunded', 'duplicate', 'mismatch') then
    raise exception 'Only completed payments can be refunded' using errcode = 'P0001';
  end if;
  select coalesce(sum(amount_minor), 0) into pending_minor from public.payment_refunds where payment_request_id = r.id and status in ('requested', 'pending', 'processed');
  if p_amount_minor <= 0 or p_amount_minor > coalesce(r.paid_amount_minor, r.amount_minor) - pending_minor then
    raise exception 'Refund is more than what is left on this payment' using errcode = '22023';
  end if;
  insert into public.payment_refunds (payment_request_id, business_id, amount_minor, currency, reason, requested_by)
  values (r.id, r.business_id, p_amount_minor, coalesce(r.paid_currency, r.currency), trim(p_reason), auth.uid())
  returning id into fid;
  return fid;
end $$;

create function public.record_refund_submission(p_refund_id uuid, p_provider_refund_id text, p_error text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(p_error, '') <> '' then
    update public.payment_refunds set status = 'failed', reason = reason || ' · provider: ' || left(p_error, 300) where id = p_refund_id and status = 'requested';
  else
    update public.payment_refunds set status = 'pending', provider_refund_id = p_provider_refund_id where id = p_refund_id and status = 'requested';
  end if;
end $$;

-- Provider-confirmed refund → reversal revenue row (negative, linked to the original charge's revenue).
create function public.apply_refund_result(p_transaction_id text, p_provider_refund_id text, p_status text, p_amount_minor bigint, p_event_id text, p_detail jsonb)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  r public.payment_requests;
  f public.payment_refunds;
  orig public.revenue_events;
  rid uuid;
  total bigint;
begin
  if p_status not in ('pending', 'processed', 'failed') then
    raise exception 'Unsupported refund status' using errcode = '22023';
  end if;
  select * into r from public.payment_requests where provider_transaction_id = p_transaction_id for update;
  if not found then
    insert into public.payment_events (provider, provider_event_id, kind, status, detail)
    values ('paystack', p_event_id, 'unmatched', p_status, coalesce(p_detail, '{}') || jsonb_build_object('transaction_id', p_transaction_id))
    on conflict (provider_event_id) do nothing;
    return 'unmatched';
  end if;
  insert into public.payment_events (payment_request_id, business_id, provider, provider_event_id, kind, status, detail)
  values (r.id, r.business_id, r.provider, p_event_id, 'refund', p_status, coalesce(p_detail, '{}') || jsonb_build_object('refund_id', p_provider_refund_id, 'amount_minor', p_amount_minor))
  on conflict (provider_event_id) do nothing;
  if not found then
    return 'duplicate_event';
  end if;
  select * into f from public.payment_refunds where provider_refund_id = p_provider_refund_id for update;
  if not found then
    -- Refunded from the provider dashboard: mirror it so revenue stays true.
    select * into f from public.payment_refunds where payment_request_id = r.id and provider_refund_id is null and status = 'requested'
      and amount_minor = p_amount_minor order by created_at limit 1 for update;
    if not found then
      insert into public.payment_refunds (payment_request_id, business_id, provider_refund_id, amount_minor, currency, reason, status)
      values (r.id, r.business_id, p_provider_refund_id, p_amount_minor, coalesce(r.paid_currency, r.currency), 'Refunded at the provider', 'pending')
      returning * into f;
    else
      update public.payment_refunds set provider_refund_id = p_provider_refund_id where id = f.id;
    end if;
  end if;
  if f.status in ('processed', 'failed') then
    return f.status;
  end if;
  if p_status = 'pending' then
    update public.payment_refunds set status = 'pending' where id = f.id;
    return 'pending';
  end if;
  if p_status = 'failed' then
    update public.payment_refunds set status = 'failed' where id = f.id;
    return 'failed';
  end if;
  -- processed: reverse Foundry's share proportionally (provider take-rate charges keep their split).
  if r.revenue_event_id is not null then
    select * into orig from public.revenue_events where id = r.revenue_event_id;
    insert into public.revenue_events (source, external_id, program_id, business_id, amount_minor, currency)
    values (orig.source || '_refund', 'refund:paystack:' || p_provider_refund_id, orig.program_id, orig.business_id,
            -round(orig.amount_minor::numeric * f.amount_minor / greatest(r.amount_minor, 1))::bigint, orig.currency)
    returning id into rid;
  end if;
  update public.payment_refunds set status = 'processed', processed_at = now(), revenue_event_id = rid where id = f.id;
  select coalesce(sum(amount_minor), 0) into total from public.payment_refunds where payment_request_id = r.id and status = 'processed';
  update public.payment_requests set refunded_minor = total,
    status = case when r.status in ('duplicate', 'mismatch') then r.status
                  when total >= coalesce(r.paid_amount_minor, r.amount_minor) then 'refunded' else 'partially_refunded' end
  where id = r.id;
  perform private.emit_event(r.business_id, 'payment.refunded', 'payment_request', r.id,
    jsonb_build_object('refund_id', p_provider_refund_id, 'amount_minor', f.amount_minor, 'reversal_revenue_event_id', rid));
  return 'processed';
end $$;

-- Disputes (chargebacks) are recorded and flagged; revenue changes only when a refund is processed.
create function public.record_payment_dispute(p_transaction_id text, p_status text, p_event_id text, p_detail jsonb) returns text
language plpgsql security definer set search_path = '' as $$
declare
  r public.payment_requests;
begin
  select * into r from public.payment_requests where provider_transaction_id = p_transaction_id for update;
  insert into public.payment_events (payment_request_id, business_id, provider, provider_event_id, kind, status, detail)
  values (r.id, r.business_id, 'paystack', p_event_id, case when r.id is null then 'unmatched' else 'dispute' end, p_status, coalesce(p_detail, '{}'))
  on conflict (provider_event_id) do nothing;
  if r.id is not null and r.status in ('succeeded', 'partially_refunded') then
    update public.payment_requests set status = 'disputed', failure_reason = 'Dispute: ' || coalesce(p_status, 'opened') where id = r.id;
  end if;
  return coalesce(r.status, 'unmatched');
end $$;

-- ─── Reconciliation ───────────────────────────────────────────────────────────
-- Requests whose outcome Foundry has not heard about: the worker verifies them with the provider.
create function public.payments_to_verify(p_limit int default 50) returns setof public.payment_requests
language sql stable security definer set search_path = '' as $$
  select * from public.payment_requests
  where status in ('created', 'pending') and created_at < now() - interval '10 minutes' and created_at > now() - interval '7 days'
    and (last_verified_at is null or last_verified_at < now() - interval '30 minutes')
  order by created_at limit p_limit;
$$;

create function public.payment_reconciliation(p_days int default 30) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_platform_admin() then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'by_status', (select coalesce(jsonb_object_agg(status, n), '{}') from (select status, count(*) n from public.payment_requests
                  where created_at > now() - make_interval(days => p_days) group by 1) x),
    'collected', (select coalesce(jsonb_agg(x), '[]') from (select currency, sum(paid_amount_minor) paid_minor, sum(refunded_minor) refunded_minor, count(*) n
                  from public.payment_requests where status in ('succeeded', 'partially_refunded', 'refunded') and paid_at > now() - make_interval(days => p_days) group by 1) x),
    'by_channel', (select coalesce(jsonb_object_agg(coalesce(payment_channel, 'unknown'), n), '{}') from (select payment_channel, count(*) n from public.payment_requests
                  where status in ('succeeded', 'partially_refunded', 'refunded') and paid_at > now() - make_interval(days => p_days) group by 1) x),
    -- Every check below must be zero for the books to reconcile.
    'checks', jsonb_build_object(
      'succeeded_without_revenue', (select count(*) from public.payment_requests where status in ('succeeded', 'partially_refunded', 'refunded') and revenue_event_id is null),
      'succeeded_charge_not_paid', (select count(*) from public.payment_requests p join public.billable_events b on b.id = p.billable_event_id
                                    where p.status in ('succeeded', 'partially_refunded', 'refunded') and b.status <> 'paid'),
      'processed_refund_without_reversal', (select count(*) from public.payment_refunds f join public.payment_requests p on p.id = f.payment_request_id
                                    where f.status = 'processed' and f.revenue_event_id is null and p.revenue_event_id is not null),
      'mismatch', (select count(*) from public.payment_requests where status = 'mismatch'),
      'duplicate', (select count(*) from public.payment_requests where status = 'duplicate' and refunded_minor < coalesce(paid_amount_minor, 0)),
      'disputed', (select count(*) from public.payment_requests where status = 'disputed'),
      'unmatched_events', (select count(*) from public.payment_events where kind = 'unmatched' and created_at > now() - make_interval(days => p_days)),
      'stuck_pending_24h', (select count(*) from public.payment_requests where status in ('created', 'pending') and created_at < now() - interval '24 hours'
                            and created_at > now() - interval '7 days')),
    'recent', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'business', bz.name, 'reference', p.reference, 'transaction_id', p.provider_transaction_id,
                 'amount_minor', p.amount_minor, 'currency', p.currency, 'status', p.status, 'channel', p.payment_channel, 'reason', p.failure_reason,
                 'refunded_minor', p.refunded_minor, 'revenue_event_id', p.revenue_event_id, 'at', p.created_at) order by p.created_at desc), '[]')
               from (select * from public.payment_requests order by created_at desc limit 30) p join public.businesses bz on bz.id = p.business_id));
end $$;

-- Payment integrity becomes a B30 incident signal (critical: money held for a person).
create or replace function public.detect_incidents() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  sig record;
  opened int := 0;
  resolved int;
  seen text[] := '{}';
  integ jsonb;
  sec jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not private.is_platform_admin() then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
  integ := public.integrity_report();
  sec := public.security_report();
  for sig in
    select 'jobs:dead:' || type fp, 'jobs' src, case when count(*) >= 10 then 'high' else 'medium' end sev,
      count(*) || ' ' || type || ' job(s) dead-lettered in 24h' title, jsonb_build_object('type', type, 'count', count(*), 'last_error', max(last_error)) det
    from public.jobs where status = 'dead' and updated_at > now() - interval '24 hours' group by type
    union all
    select 'webhooks:failed:' || program_id, 'webhooks', 'medium', count(*) || ' webhook deliveries failed', jsonb_build_object('program_id', program_id, 'count', count(*))
    from public.webhook_deliveries d join public.webhook_subscriptions w on w.id = d.subscription_id
    where d.status = 'failed' and d.created_at > now() - interval '24 hours' group by program_id
    union all
    select 'integrity:' || k, 'integrity', 'high', 'Data integrity check failing: ' || k, jsonb_build_object('check', k, 'count', v)
    from jsonb_each_text(integ) x(k, v) where k not in ('dead_jobs_7d', 'negative_stock_products') and v ~ '^\d+$' and v::int > 0
    union all
    select 'security:' || k, 'security', 'critical', 'Security check failing: ' || k, jsonb_build_object('check', k, 'items', v)
    from jsonb_each(sec) x(k, v) where jsonb_typeof(v) = 'array' and jsonb_array_length(v) > 0
    union all
    select 'drift:' || scope || ':' || subject, 'drift', 'medium', 'Model/metric drift: ' || scope || ' · ' || subject, jsonb_build_object('scope', scope, 'subject', subject)
    from public.eval_snapshots where drift and taken_on > current_date - 7
    union all
    select 'policy:denials:' || policy_key, 'policy', 'low', count(*) || ' ' || policy_key || ' denials in 24h', jsonb_build_object('policy', policy_key, 'count', count(*))
    from public.policy_decisions where result = 'deny' and decided_at > now() - interval '24 hours' group by policy_key having count(*) >= 20
    union all
    select 'experiments:guardrail:' || id, 'experiments', 'medium', 'Experiment stopped by guardrail: ' || name, jsonb_build_object('experiment_id', id, 'conclusion', conclusion)
    from public.experiments where status = 'stopped' and conclusion like 'Stopped automatically%' and ended_at > now() - interval '7 days'
    union all
    select 'billing:overdue', 'billing', 'medium', count(*) || ' charges open for 30+ days', jsonb_build_object('count', count(*), 'amount_usd', round(sum(private.to_usd(amount_minor, currency)), 2))
    from public.billable_events where status = 'open' and created_at < now() - interval '30 days' having count(*) > 0
    union all
    select 'billing:payments:' || status, 'billing', 'critical', count(*) || ' payment(s) held: ' || status, jsonb_build_object('status', status, 'count', count(*), 'references', jsonb_agg(reference))
    from public.payment_requests where status in ('mismatch', 'duplicate', 'disputed') and refunded_minor < coalesce(paid_amount_minor, amount_minor) group by status
  loop
    seen := seen || sig.fp;
    insert into public.incidents (fingerprint, source, severity, title, detail)
    values (sig.fp, sig.src, sig.sev, sig.title, sig.det)
    on conflict (fingerprint) where status <> 'resolved' do update set last_seen_at = now(), title = excluded.title, detail = excluded.detail, severity = excluded.severity;
  end loop;
  get diagnostics opened = row_count;
  update public.incidents set status = 'resolved', resolved_at = now() where status <> 'resolved' and not (fingerprint = any (seen));
  get diagnostics resolved = row_count;
  return jsonb_build_object('active', cardinality(seen), 'resolved', resolved);
end $$;

-- ─── Grants and RLS ───────────────────────────────────────────────────────────
revoke execute on function public.create_payment_request(uuid), public.request_payment_refund(uuid, bigint, text), public.payment_reconciliation(int) from public, anon;
grant execute on function public.create_payment_request(uuid), public.request_payment_refund(uuid, bigint, text), public.payment_reconciliation(int) to authenticated;
revoke execute on function public.record_payment_initialized(uuid, text, text, text),
  public.apply_payment_result(text, text, text, bigint, text, text, timestamptz, text, text, jsonb),
  public.record_refund_submission(uuid, text, text), public.apply_refund_result(text, text, text, bigint, text, jsonb),
  public.record_payment_dispute(text, text, text, jsonb), public.payments_to_verify(int) from public, anon, authenticated;
grant execute on function public.record_payment_initialized(uuid, text, text, text),
  public.apply_payment_result(text, text, text, bigint, text, text, timestamptz, text, text, jsonb),
  public.record_refund_submission(uuid, text, text), public.apply_refund_result(text, text, text, bigint, text, jsonb),
  public.record_payment_dispute(text, text, text, jsonb), public.payments_to_verify(int) to service_role;

alter table public.payment_requests enable row level security;
alter table public.payment_events enable row level security;
alter table public.payment_refunds enable row level security;
create policy "payments: readers" on public.payment_requests for select to authenticated using (private.can_read(business_id) or private.is_platform_admin());
create policy "payment events: admins" on public.payment_events for select to authenticated using (private.is_platform_admin());
create policy "refunds: readers" on public.payment_refunds for select to authenticated using (private.can_read(business_id) or private.is_platform_admin());
revoke insert, update, delete on public.payment_requests, public.payment_events, public.payment_refunds from authenticated, anon;
