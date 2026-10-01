-- Batch 4: operational backbone.
--   events          append-only domain event log (what happened, visible to the business)
--   audit_log       row-level change history (who changed what, owners only)
--   jobs            durable work queue with retries, backoff, dead-lettering
--   idempotency     exactly-once handling for client retries (offline outbox, webhooks)
--   rate limits     fixed-window counters shared across app instances

create type public.actor_type as enum ('user', 'agent', 'system');
create type public.job_status as enum ('queued', 'running', 'succeeded', 'failed', 'dead');

-- ─── Events ───────────────────────────────────────────────────────────────────
create table public.events (
  id           bigint generated always as identity primary key,
  business_id  uuid not null references public.businesses (id) on delete cascade,
  type         text not null check (type ~ '^[a-z_]+(\.[a-z_]+)+$'),
  actor_type   public.actor_type not null default 'user',
  actor_id     uuid,
  entity_type  text,
  entity_id    uuid,
  payload      jsonb not null default '{}',
  occurred_at  timestamptz not null default now()
);
create index events_business_time_idx on public.events (business_id, occurred_at desc);
create index events_business_type_idx on public.events (business_id, type, occurred_at desc);

create function private.emit_event(
  p_business_id uuid, p_type text, p_entity_type text default null, p_entity_id uuid default null,
  p_payload jsonb default '{}', p_actor_type public.actor_type default null
) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  new_id bigint;
begin
  insert into public.events (business_id, type, actor_type, actor_id, entity_type, entity_id, payload)
  values (p_business_id, p_type,
          coalesce(p_actor_type, case when uid is null then 'system' else 'user' end::public.actor_type),
          uid, p_entity_type, p_entity_id, coalesce(p_payload, '{}'))
  returning id into new_id;
  return new_id;
end $$;

-- ─── Audit log (no FK: history outlives the rows it describes) ─────────────────
create table public.audit_log (
  id           bigint generated always as identity primary key,
  business_id  uuid not null,
  table_name   text not null,
  row_id       text,
  action       text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  actor_id     uuid,
  old_row      jsonb,
  new_row      jsonb,
  changed_at   timestamptz not null default now()
);
create index audit_log_business_time_idx on public.audit_log (business_id, changed_at desc);

create function private.audit_row() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  o jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  n jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
  r jsonb := coalesce(n, o);
  bid uuid := coalesce(r ->> 'business_id', case when tg_table_name = 'businesses' then r ->> 'id' end)::uuid;
begin
  if tg_op = 'UPDATE' and o = n then
    return new;
  end if;
  insert into public.audit_log (business_id, table_name, row_id, action, actor_id, old_row, new_row)
  values (bid, tg_table_name, coalesce(r ->> 'id', r ->> 'user_id'), tg_op, auth.uid(), o, n);
  return coalesce(new, old);
end $$;

create trigger businesses_audit after insert or update or delete on public.businesses
  for each row execute function private.audit_row();
create trigger memberships_audit after insert or update or delete on public.memberships
  for each row execute function private.audit_row();

-- Domain events for tenancy changes.
create function private.tenancy_events() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'businesses' then
    perform private.emit_event(new.id, 'business.created', 'business', new.id, jsonb_build_object('name', new.name));
  elsif tg_op = 'INSERT' then
    perform private.emit_event(new.business_id, 'member.added', 'user', new.user_id, jsonb_build_object('role', new.role));
  elsif tg_op = 'UPDATE' and old.role <> new.role then
    perform private.emit_event(new.business_id, 'member.role_changed', 'user', new.user_id,
      jsonb_build_object('from', old.role, 'to', new.role));
  elsif tg_op = 'DELETE' and exists (select 1 from public.businesses where id = old.business_id) then
    perform private.emit_event(old.business_id, 'member.removed', 'user', old.user_id, '{}');
  end if;
  return coalesce(new, old);
end $$;
create trigger businesses_events after insert on public.businesses
  for each row execute function private.tenancy_events();
create trigger memberships_events after insert or update or delete on public.memberships
  for each row execute function private.tenancy_events();

-- ─── Jobs ─────────────────────────────────────────────────────────────────────
create table public.jobs (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid references public.businesses (id) on delete cascade,
  type          text not null check (type ~ '^[a-z_]+(\.[a-z_]+)+$'),
  payload       jsonb not null default '{}',
  status        public.job_status not null default 'queued',
  priority      smallint not null default 100,
  attempts      int not null default 0,
  max_attempts  int not null default 5 check (max_attempts between 1 and 25),
  run_at        timestamptz not null default now(),
  locked_at     timestamptz,
  locked_by     text,
  last_error    text,
  dedupe_key    text,
  result        jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  finished_at   timestamptz
);
create index jobs_ready_idx on public.jobs (priority, run_at) where status = 'queued';
create index jobs_running_idx on public.jobs (locked_at) where status = 'running';
create index jobs_business_idx on public.jobs (business_id, created_at desc);
create unique index jobs_dedupe_active_idx on public.jobs (dedupe_key)
  where dedupe_key is not null and status in ('queued', 'running');
create trigger jobs_touch before update on public.jobs
  for each row execute function private.touch_updated_at();

create function private.enqueue_job(
  p_type text, p_business_id uuid default null, p_payload jsonb default '{}',
  p_dedupe_key text default null, p_run_at timestamptz default now(),
  p_max_attempts int default 5, p_priority smallint default 100
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  job_id uuid;
begin
  insert into public.jobs (type, business_id, payload, dedupe_key, run_at, max_attempts, priority)
  values (p_type, p_business_id, coalesce(p_payload, '{}'), p_dedupe_key, coalesce(p_run_at, now()), p_max_attempts, p_priority)
  on conflict (dedupe_key) where dedupe_key is not null and status in ('queued', 'running') do nothing
  returning id into job_id;
  if job_id is null then
    select id into job_id from public.jobs
    where dedupe_key = p_dedupe_key and status in ('queued', 'running') limit 1;
  end if;
  return job_id;
end $$;

-- Worker API (service role only).
create function public.enqueue_job(
  p_type text, p_business_id uuid default null, p_payload jsonb default '{}',
  p_dedupe_key text default null, p_run_at timestamptz default now(), p_max_attempts int default 5
) returns uuid
language sql security definer set search_path = '' as $$
  select private.enqueue_job(p_type, p_business_id, p_payload, p_dedupe_key, p_run_at, p_max_attempts);
$$;

create function public.claim_jobs(p_worker text, p_limit int default 10, p_types text[] default null, p_job_id uuid default null)
returns setof public.jobs
language sql security definer set search_path = '' as $$
  with ready as (
    select id from public.jobs
    where status = 'queued' and run_at <= now()
      and (p_types is null or type = any (p_types))
      and (p_job_id is null or id = p_job_id)
    order by priority, run_at
    limit greatest(1, least(p_limit, 100))
    for update skip locked
  )
  update public.jobs j
  set status = 'running', locked_at = now(), locked_by = p_worker, attempts = j.attempts + 1
  from ready where j.id = ready.id
  returning j.*;
$$;

create function public.complete_job(p_job_id uuid, p_result jsonb default null) returns void
language sql security definer set search_path = '' as $$
  update public.jobs
  set status = 'succeeded', result = p_result, finished_at = now(), locked_at = null, last_error = null
  where id = p_job_id and status = 'running';
$$;

-- Exponential backoff: 15s · 2^(attempt-1), capped at 1h, with up to 20% jitter.
create function public.fail_job(p_job_id uuid, p_error text, p_retryable boolean default true) returns public.job_status
language plpgsql security definer set search_path = '' as $$
declare
  j public.jobs;
  next_status public.job_status;
begin
  select * into j from public.jobs where id = p_job_id and status = 'running' for update;
  if not found then
    return null;
  end if;
  next_status := case when p_retryable and j.attempts < j.max_attempts then 'queued'::public.job_status else 'dead'::public.job_status end;
  update public.jobs
  set status = next_status,
      last_error = left(p_error, 2000),
      locked_at = null,
      locked_by = null,
      run_at = case when next_status = 'queued'
                 then now() + least(interval '1 hour', interval '15 seconds' * power(2, j.attempts - 1)) * (1 + random() * 0.2)
                 else run_at end,
      finished_at = case when next_status = 'dead' then now() end
  where id = p_job_id;
  if next_status = 'dead' and j.business_id is not null then
    perform private.emit_event(j.business_id, 'job.dead', 'job', j.id,
      jsonb_build_object('type', j.type, 'error', left(p_error, 300)), 'system');
  end if;
  return next_status;
end $$;

-- Workers that crash leave jobs 'running'; put them back (the failed attempt still counts).
create function public.reap_stale_jobs(p_timeout interval default interval '10 minutes') returns int
language plpgsql security definer set search_path = '' as $$
declare
  n int;
begin
  update public.jobs
  set status = case when attempts >= max_attempts then 'dead'::public.job_status else 'queued'::public.job_status end,
      locked_at = null, locked_by = null, last_error = coalesce(last_error, 'worker timed out'),
      finished_at = case when attempts >= max_attempts then now() end
  where status = 'running' and locked_at < now() - p_timeout;
  get diagnostics n = row_count;
  return n;
end $$;

-- ─── Idempotency ──────────────────────────────────────────────────────────────
create table public.idempotency_keys (
  scope         text not null,
  key           text not null check (char_length(key) between 8 and 200),
  request_hash  text not null,
  status        text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  response      jsonb,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default now() + interval '48 hours',
  primary key (scope, key)
);
create index idempotency_expiry_idx on public.idempotency_keys (expires_at);

-- ─── Rate limiting ────────────────────────────────────────────────────────────
create unlogged table private.rate_limits (
  key           text not null,
  window_start  timestamptz not null,
  hits          int not null default 0,
  primary key (key, window_start)
);

-- Returns true when the call is allowed.
create function public.hit_rate_limit(p_key text, p_limit int, p_window_seconds int) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  win timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  n int;
begin
  insert into private.rate_limits as r (key, window_start, hits) values (p_key, win, 1)
  on conflict (key, window_start) do update set hits = r.hits + 1
  returning hits into n;
  return n <= p_limit;
end $$;

create function public.purge_expired_ops() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  idem int; rl int; jobs_n int;
begin
  delete from public.idempotency_keys where expires_at < now();
  get diagnostics idem = row_count;
  delete from private.rate_limits where window_start < now() - interval '1 day';
  get diagnostics rl = row_count;
  delete from public.jobs where status = 'succeeded' and finished_at < now() - interval '14 days';
  get diagnostics jobs_n = row_count;
  return jsonb_build_object('idempotency_keys', idem, 'rate_limits', rl, 'jobs', jobs_n);
end $$;

-- ─── Grants & RLS ─────────────────────────────────────────────────────────────
revoke execute on function public.enqueue_job(text, uuid, jsonb, text, timestamptz, int),
  public.claim_jobs(text, int, text[], uuid), public.complete_job(uuid, jsonb),
  public.fail_job(uuid, text, boolean), public.reap_stale_jobs(interval),
  public.hit_rate_limit(text, int, int), public.purge_expired_ops()
  from public, anon, authenticated;
grant execute on function public.enqueue_job(text, uuid, jsonb, text, timestamptz, int),
  public.claim_jobs(text, int, text[], uuid), public.complete_job(uuid, jsonb),
  public.fail_job(uuid, text, boolean), public.reap_stale_jobs(interval),
  public.hit_rate_limit(text, int, int), public.purge_expired_ops()
  to service_role;

alter table public.events enable row level security;
alter table public.audit_log enable row level security;
alter table public.jobs enable row level security;
alter table public.idempotency_keys enable row level security;

create policy "events: readers" on public.events for select to authenticated
  using (private.can_read(business_id));
create policy "audit: owners" on public.audit_log for select to authenticated
  using (private.has_role(business_id, array['owner']::public.business_role[]));
create policy "jobs: members see their business work" on public.jobs for select to authenticated
  using (business_id is not null and private.is_member(business_id));
-- idempotency_keys: service role only (no policies).

grant select on public.events, public.audit_log, public.jobs to authenticated;
revoke all on public.idempotency_keys from authenticated;

-- Defense in depth: the log tables are written only by definer functions and triggers.
revoke insert, update, delete on public.events, public.audit_log, public.jobs from authenticated;
-- RLS does not apply to TRUNCATE.
revoke truncate on all tables in schema public from authenticated;
alter default privileges for role postgres in schema public revoke truncate on tables from authenticated;
