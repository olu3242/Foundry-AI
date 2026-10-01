-- B27 Enterprise/API platform: versioned HTTP API for approved external systems, scoped service
-- identities (hashed keys), webhooks with signed deliveries and retries, a sandbox environment,
-- per-identity rate limits and a full integration audit. No partner ever gets database access:
-- every call goes through /api/v1 → these functions, bounded by program consent (B10/B15).

alter table public.programs add column is_sandbox boolean not null default false;

create table public.service_identities (
  id              uuid primary key default gen_random_uuid(),
  program_id      uuid not null references public.programs (id) on delete cascade,
  name            text not null check (char_length(name) between 2 and 80),
  environment     text not null check (environment in ('live', 'sandbox')),
  scopes          text[] not null check (scopes <@ array['businesses:read', 'outcomes:read', 'reports:read', 'invitations:write', 'events:subscribe']::text[]
                                         and cardinality(scopes) > 0),
  key_prefix      text not null,
  key_hash        text not null unique,
  rate_limit_per_min int not null default 60 check (rate_limit_per_min between 1 and 6000),
  status          text not null default 'active' check (status in ('active', 'revoked')),
  created_by      uuid not null default auth.uid() references public.profiles (id),
  created_at      timestamptz not null default now(),
  last_used_at    timestamptz,
  revoked_at      timestamptz
);
create index service_identities_program_idx on public.service_identities (program_id);
create trigger service_identities_audit after insert or update of status, scopes on public.service_identities for each row execute function private.audit_row();

create table public.integration_calls (
  id           bigint generated always as identity primary key,
  identity_id  uuid references public.service_identities (id) on delete set null,
  program_id   uuid references public.programs (id) on delete cascade,
  method       text not null,
  path         text not null,
  status       int not null,
  latency_ms   int,
  request_id   text,
  error        text,
  at           timestamptz not null default now()
);
create index integration_calls_program_idx on public.integration_calls (program_id, at desc);
create index integration_calls_identity_idx on public.integration_calls (identity_id, at desc);

create table public.webhook_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  identity_id  uuid not null references public.service_identities (id) on delete cascade,
  program_id   uuid not null references public.programs (id) on delete cascade,
  url          text not null check (url ~ '^https?://'),
  event_types  text[] not null check (event_types <@ array['intervention.started', 'intervention.completed', 'outcome.verified', 'verification.attested', 'sandbox.ping']::text[]),
  secret       text not null,
  status       text not null default 'active' check (status in ('active', 'disabled')),
  created_at   timestamptz not null default now()
);
create index webhook_subscriptions_program_idx on public.webhook_subscriptions (program_id) where status = 'active';

create table public.webhook_deliveries (
  id               uuid primary key default gen_random_uuid(),
  subscription_id  uuid not null references public.webhook_subscriptions (id) on delete cascade,
  event_id         bigint,
  event_type       text not null,
  payload          jsonb not null,
  status           text not null default 'pending' check (status in ('pending', 'delivered', 'failed')),
  attempts         int not null default 0,
  response_status  int,
  last_error       text,
  created_at       timestamptz not null default now(),
  delivered_at     timestamptz,
  unique (subscription_id, event_id)
);
create index webhook_deliveries_sub_idx on public.webhook_deliveries (subscription_id, created_at desc);

-- ─── Identity management (program admins) ─────────────────────────────────────
create function public.create_sandbox_program(p_program_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  p public.programs;
  sid uuid;
begin
  if not private.is_program_member(p_program_id, array['admin']::public.program_role[]) then
    raise exception 'Program admins only' using errcode = '42501';
  end if;
  select * into p from public.programs where id = p_program_id;
  if p.is_sandbox then
    raise exception 'This is already a sandbox' using errcode = 'P0001';
  end if;
  sid := public.create_program(p.name || ' (sandbox)', p.sponsor_name, 'Test environment: invite test businesses only.');
  update public.programs set is_sandbox = true where id = sid;
  return sid;
end $$;

-- Returns the key once; only its hash is stored.
create function public.create_service_identity(p_program_id uuid, p_name text, p_scopes text[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  env text;
  k text;
  iid uuid;
begin
  if not private.is_program_member(p_program_id, array['admin']::public.program_role[]) then
    raise exception 'Program admins only' using errcode = '42501';
  end if;
  select case when is_sandbox then 'sandbox' else 'live' end into env from public.programs where id = p_program_id;
  k := 'fdy_' || env || '_' || encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.service_identities (program_id, name, environment, scopes, key_prefix, key_hash)
  values (p_program_id, trim(p_name), env, p_scopes, left(k, 16), encode(extensions.digest(k, 'sha256'), 'hex'))
  returning id into iid;
  return jsonb_build_object('id', iid, 'key', k, 'environment', env);
end $$;

create function public.revoke_service_identity(p_identity_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.service_identities set status = 'revoked', revoked_at = now()
  where id = p_identity_id and status = 'active' and private.is_program_member(program_id, array['admin']::public.program_role[]);
  if not found then
    raise exception 'Not found or not allowed' using errcode = '42501';
  end if;
end $$;

create function public.program_integrations(p_program_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_program_member(p_program_id, array['admin']::public.program_role[]) then
    raise exception 'Program admins only' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'identities', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'environment', environment, 'scopes', scopes, 'key_prefix', key_prefix,
        'status', status, 'last_used_at', last_used_at, 'rate_limit_per_min', rate_limit_per_min) order by created_at desc), '[]')
      from public.service_identities where program_id = p_program_id),
    'webhooks', (select coalesce(jsonb_agg(jsonb_build_object('id', w.id, 'url', w.url, 'event_types', w.event_types, 'status', w.status, 'identity', s.name,
        'delivered', (select count(*) from public.webhook_deliveries d where d.subscription_id = w.id and d.status = 'delivered'),
        'failed', (select count(*) from public.webhook_deliveries d where d.subscription_id = w.id and d.status = 'failed'),
        'pending', (select count(*) from public.webhook_deliveries d where d.subscription_id = w.id and d.status = 'pending'))), '[]')
      from public.webhook_subscriptions w join public.service_identities s on s.id = w.identity_id where w.program_id = p_program_id),
    'calls', (select coalesce(jsonb_agg(jsonb_build_object('method', method, 'path', path, 'status', status, 'latency_ms', latency_ms, 'at', at) order by at desc), '[]')
      from (select * from public.integration_calls where program_id = p_program_id order by at desc limit 25) c)
  );
end $$;

create function public.create_webhook_subscription(p_identity_id uuid, p_url text, p_event_types text[]) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  s public.service_identities;
  secret text := 'whsec_' || encode(extensions.gen_random_bytes(24), 'hex');
  wid uuid;
begin
  select * into s from public.service_identities where id = p_identity_id;
  if not found or s.status <> 'active' or not private.is_program_member(s.program_id, array['admin']::public.program_role[]) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if not ('events:subscribe' = any (s.scopes)) then
    raise exception 'That key has no events:subscribe scope' using errcode = 'P0001';
  end if;
  if s.environment = 'live' and p_url !~ '^https://' then
    raise exception 'Live webhooks must use https' using errcode = '22023';
  end if;
  insert into public.webhook_subscriptions (identity_id, program_id, url, event_types, secret)
  values (s.id, s.program_id, p_url, p_event_types, secret) returning id into wid;
  return jsonb_build_object('id', wid, 'secret', secret);
end $$;

-- ─── API surface (service role only; called by /api/v1 after key verification) ─
create function public.api_authenticate(p_key_hash text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  s public.service_identities;
begin
  update public.service_identities set last_used_at = now() where key_hash = p_key_hash and status = 'active' returning * into s;
  if s.id is null then
    return null;
  end if;
  return jsonb_build_object('id', s.id, 'program_id', s.program_id, 'environment', s.environment, 'scopes', s.scopes, 'rate_limit_per_min', s.rate_limit_per_min);
end $$;

create function private.api_identity(iid uuid, scope text) returns public.service_identities
language plpgsql stable security definer set search_path = '' as $$
declare
  s public.service_identities;
begin
  select * into s from public.service_identities where id = iid and status = 'active';
  if s.id is null or not (scope = any (s.scopes)) then
    raise exception 'insufficient_scope' using errcode = '42501';
  end if;
  return s;
end $$;

create function public.api_list_businesses(p_identity_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  s public.service_identities := private.api_identity(p_identity_id, 'businesses:read');
begin
  return (select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'name', b.name, 'country', b.country_code, 'currency', b.currency,
      'enrolled_at', e.enrolled_at, 'stage', h.stage, 'risk', h.risk) order by e.enrolled_at), '[]')
    from public.program_enrollments e join public.businesses b on b.id = e.business_id
    left join public.business_health h on h.business_id = b.id
    where e.program_id = s.program_id and e.status = 'active' and 'records' = any (e.consent_scope));
end $$;

create function public.api_business_outcomes(p_identity_id uuid, p_business_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  s public.service_identities := private.api_identity(p_identity_id, 'outcomes:read');
begin
  if not exists (select 1 from public.program_enrollments where program_id = s.program_id and business_id = p_business_id and status = 'active') then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'plan', i.title, 'metric', o.metric, 'baseline', o.baseline_value, 'observed', o.observed_value,
      'delta', o.delta, 'improved', o.improved, 'status', o.status, 'window_end', o.window_end, 'verified_at', o.verified_at) order by o.window_end desc), '[]')
    from public.outcomes o join public.interventions i on i.id = o.intervention_id where o.business_id = p_business_id);
end $$;

create function private.program_report_body(p_program_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  result jsonb;
begin
  with e as (select business_id, enrolled_at from public.program_enrollments where program_id = p_program_id and status = 'active'),
  latest as (
    select distinct on (s.business_id, s.dimension) s.business_id, s.state from public.pulse_snapshots s
    where s.business_id in (select business_id from e) order by s.business_id, s.dimension, s.computed_on desc
  ),
  ev as (select business_id, type, occurred_at from public.events where business_id in (select business_id from e)),
  inv as (select * from public.program_invitations where program_id = p_program_id),
  o as (select o.* from public.outcomes o where o.business_id in (select business_id from e))
  select jsonb_build_object(
    'enrolled', (select count(*) from e),
    'active_30d', (select count(distinct business_id) from ev where type in ('sale.recorded', 'expense.recorded', 'capture.received') and occurred_at > now() - interval '30 days'),
    'invited', (select count(*) from inv),
    'accepted', (select count(*) from inv where status = 'accepted'),
    'conversion', (select round(count(*) filter (where status = 'accepted')::numeric / nullif(count(*), 0), 3) from inv),
    'by_channel', (select coalesce(jsonb_object_agg(channel, case when n < 5 then '<5' else n::text end), '{}') from (
        select a.channel, count(*) n from public.acquisition_attributions a where a.program_id = p_program_id group by 1) x),
    'activation', jsonb_build_object(
      'first_record', (select count(distinct business_id) from ev where type in ('sale.recorded', 'expense.recorded')),
      'first_plan', (select count(distinct business_id) from ev where type = 'intervention.started'),
      'first_verified_outcome', (select count(distinct business_id) from ev where type = 'outcome.verified')),
    'pulse_states', (select coalesce(jsonb_object_agg(state, n), '{}') from (select state, count(*) n from latest group by 1) x),
    'outcomes', jsonb_build_object(
      'observed', (select count(*) from o), 'improved', (select count(*) from o where improved),
      'verified_improved', (select count(*) from o where improved and status = 'verified')),
    'consent', jsonb_build_object(
      'active', (select count(*) from e),
      'withdrawn', (select count(*) from public.program_enrollments where program_id = p_program_id and status = 'left'))
  ) into result;
  return result;
end $$;

create or replace function public.program_report(p_program_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_program_member(p_program_id, array['admin']::public.program_role[]) then
    raise exception 'Program admins only' using errcode = '42501';
  end if;
  return private.program_report_body(p_program_id);
end $$;

create function public.api_program_report(p_identity_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  s public.service_identities := private.api_identity(p_identity_id, 'reports:read');
begin
  return private.program_report_body(s.program_id);
end $$;

create function public.api_invite(p_identity_id uuid, p_contacts text[]) returns int
language plpgsql security definer set search_path = '' as $$
declare
  s public.service_identities := private.api_identity(p_identity_id, 'invitations:write');
  n int;
begin
  if cardinality(p_contacts) > 500 then
    raise exception 'At most 500 invitations at a time' using errcode = 'P0001';
  end if;
  insert into public.program_invitations (program_id, contact, invited_by)
  select s.program_id, c, s.created_by from (select distinct private.normalize_contact(x) c from unnest(p_contacts) x) t
  where char_length(c) >= 5
  on conflict (program_id, contact) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

create function public.api_log_call(p_identity_id uuid, p_method text, p_path text, p_status int, p_latency_ms int, p_request_id text, p_error text default null)
returns void language sql security definer set search_path = '' as $$
  insert into public.integration_calls (identity_id, program_id, method, path, status, latency_ms, request_id, error)
  values (p_identity_id, (select program_id from public.service_identities where id = p_identity_id), p_method, p_path, p_status, p_latency_ms, p_request_id, p_error);
$$;

-- Test event for a sandbox or live subscription.
create function public.api_send_test_event(p_identity_id uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare
  s public.service_identities := private.api_identity(p_identity_id, 'events:subscribe');
  n int := 0;
  w record;
  did uuid;
begin
  for w in select id from public.webhook_subscriptions where identity_id = s.id and status = 'active' and 'sandbox.ping' = any (event_types) loop
    insert into public.webhook_deliveries (subscription_id, event_type, payload)
    values (w.id, 'sandbox.ping', jsonb_build_object('type', 'sandbox.ping', 'occurred_at', now(), 'data', jsonb_build_object('message', 'Hello from Foundry')))
    returning id into did;
    perform private.enqueue_job('webhook.deliver', null, jsonb_build_object('delivery_id', did), 'wh:' || did);
    n := n + 1;
  end loop;
  return n;
end $$;

-- ─── Event fan-out to subscribed programs (consented businesses only) ─────────
create function private.fan_out_webhooks() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  w record;
  did uuid;
begin
  for w in
    select ws.id, ws.program_id from public.webhook_subscriptions ws
    join public.program_enrollments e on e.program_id = ws.program_id and e.business_id = new.business_id and e.status = 'active'
    where ws.status = 'active' and new.type = any (ws.event_types)
  loop
    insert into public.webhook_deliveries (subscription_id, event_id, event_type, payload)
    values (w.id, new.id, new.type, jsonb_build_object('id', new.id, 'type', new.type, 'occurred_at', new.occurred_at, 'business_id', new.business_id,
            'entity', jsonb_build_object('type', new.entity_type, 'id', new.entity_id), 'data', new.payload))
    on conflict (subscription_id, event_id) do nothing
    returning id into did;
    if did is not null then
      perform private.enqueue_job('webhook.deliver', new.business_id, jsonb_build_object('delivery_id', did), 'wh:' || did);
    end if;
  end loop;
  return null;
end $$;
create trigger events_webhooks after insert on public.events for each row
  when (new.type in ('intervention.started', 'intervention.completed', 'outcome.verified', 'verification.attested'))
  execute function private.fan_out_webhooks();

-- Worker reads what it needs to sign and send; records the attempt.
create function public.webhook_delivery_for_send(p_delivery_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', d.id, 'url', w.url, 'secret', w.secret, 'event_type', d.event_type, 'payload', d.payload, 'status', d.status, 'attempts', d.attempts,
                            'active', w.status = 'active' and s.status = 'active')
  from public.webhook_deliveries d join public.webhook_subscriptions w on w.id = d.subscription_id join public.service_identities s on s.id = w.identity_id
  where d.id = p_delivery_id;
$$;

create function public.record_webhook_attempt(p_delivery_id uuid, p_status int, p_error text, p_final boolean) returns void
language sql security definer set search_path = '' as $$
  update public.webhook_deliveries set attempts = attempts + 1, response_status = p_status, last_error = nullif(p_error, ''),
    status = case when p_status between 200 and 299 then 'delivered' when p_final then 'failed' else 'pending' end,
    delivered_at = case when p_status between 200 and 299 then now() end
  where id = p_delivery_id;
$$;

revoke execute on function public.create_sandbox_program(uuid), public.create_service_identity(uuid, text, text[]), public.revoke_service_identity(uuid),
  public.program_integrations(uuid), public.create_webhook_subscription(uuid, text, text[]) from public, anon;
grant execute on function public.create_sandbox_program(uuid), public.create_service_identity(uuid, text, text[]), public.revoke_service_identity(uuid),
  public.program_integrations(uuid), public.create_webhook_subscription(uuid, text, text[]) to authenticated;
revoke execute on function public.api_authenticate(text), public.api_list_businesses(uuid), public.api_business_outcomes(uuid, uuid),
  public.api_program_report(uuid), public.api_invite(uuid, text[]), public.api_log_call(uuid, text, text, int, int, text, text),
  public.api_send_test_event(uuid), public.webhook_delivery_for_send(uuid), public.record_webhook_attempt(uuid, int, text, boolean)
  from public, anon, authenticated;
grant execute on function public.api_authenticate(text), public.api_list_businesses(uuid), public.api_business_outcomes(uuid, uuid),
  public.api_program_report(uuid), public.api_invite(uuid, text[]), public.api_log_call(uuid, text, text, int, int, text, text),
  public.api_send_test_event(uuid), public.webhook_delivery_for_send(uuid), public.record_webhook_attempt(uuid, int, text, boolean)
  to service_role;

alter table public.service_identities enable row level security;
alter table public.integration_calls enable row level security;
alter table public.webhook_subscriptions enable row level security;
alter table public.webhook_deliveries enable row level security;
-- No direct reads: keys, secrets and call logs are only exposed through program_integrations().
revoke all on public.service_identities, public.integration_calls, public.webhook_subscriptions, public.webhook_deliveries from authenticated;
