-- B11 Pilot activation: baselines, activation milestones, Pulse feedback, interventions and
-- verified outcomes. Completes the loop PULSE → SOLVE → EXECUTE → EVIDENCE → OUTCOME → PASSPORT.
-- Reuses: B10 programs (cohorts) + partner_assignments (operators), B7 pulse_metrics, B4 events/jobs.

alter table public.programs
  add column phase text not null default 'active' check (phase in ('setup', 'recruiting', 'active', 'completed')),
  add column starts_on date,
  add column ends_on date;
grant update (phase, starts_on, ends_on) on public.programs to authenticated;

-- Outcome metrics are pulse_metrics keys; direction says which way is better.
create function private.metric_direction(p_metric text) returns text
language sql immutable as $$
  select case p_metric
    when 'sales_30' then 'up' when 'collected_30' then 'up' when 'active_days_30' then 'up'
    when 'repeat_customers_60' then 'up' when 'records_verified_30' then 'up'
    when 'expenses_30' then 'down' when 'receivable_total' then 'down' when 'receivable_over_30' then 'down'
  end;
$$;

-- ─── Baselines ────────────────────────────────────────────────────────────────
create table public.business_baselines (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses (id) on delete cascade,
  program_id   uuid references public.programs (id) on delete cascade,
  captured_at  timestamptz not null default now(),
  metrics      jsonb not null,
  pulse        jsonb not null default '[]',
  unique nulls not distinct (business_id, program_id)
);

create function private.on_enrollment() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'active' and (tg_op = 'INSERT' or old.status <> 'active') then
    perform private.enqueue_job('pilot.baseline', new.business_id, jsonb_build_object('program_id', new.program_id),
                                'baseline:' || new.business_id || ':' || new.program_id);
  end if;
  return new;
end $$;
create trigger program_enrollments_baseline after insert or update on public.program_enrollments
  for each row execute function private.on_enrollment();

-- ─── Pulse feedback (calibration input for B18) ───────────────────────────────
create table public.pulse_feedback (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses (id) on delete cascade,
  dimension    text not null,
  computed_on  date not null,
  verdict      text not null check (verdict in ('accurate', 'inaccurate', 'unclear')),
  note         text check (char_length(note) <= 500),
  user_id      uuid not null default auth.uid() references public.profiles (id),
  user_role    public.business_role not null,
  created_at   timestamptz not null default now(),
  unique (business_id, dimension, computed_on, user_id)
);

create function public.give_pulse_feedback(p_business_id uuid, p_dimension text, p_computed_on date, p_verdict text, p_note text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  r public.business_role := public.my_business_role(p_business_id);
begin
  if r is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  insert into public.pulse_feedback (business_id, dimension, computed_on, verdict, note, user_role)
  values (p_business_id, p_dimension, p_computed_on, p_verdict, p_note, r)
  on conflict (business_id, dimension, computed_on, user_id) do update set verdict = excluded.verdict, note = excluded.note, created_at = now();
end $$;

-- ─── Interventions & outcomes ─────────────────────────────────────────────────
create type public.intervention_status as enum ('active', 'completed', 'abandoned');
create type public.outcome_status as enum ('observed', 'verified', 'disputed');

create table public.interventions (
  id                   uuid primary key default gen_random_uuid(),
  business_id          uuid not null references public.businesses (id) on delete cascade,
  source_action_id     uuid references public.agent_actions (id) on delete set null,
  solution_version_id  uuid,
  title                text not null check (char_length(title) between 3 and 160),
  target_metric        text not null check (private.metric_direction(target_metric) is not null),
  expected_direction   text not null check (expected_direction in ('up', 'down')),
  baseline_value       numeric not null,
  window_days          int not null default 30 check (window_days between 1 and 180),
  status               public.intervention_status not null default 'active',
  abandon_reason       text check (abandon_reason in ('not_relevant', 'too_hard', 'no_time', 'no_money', 'did_not_work', 'other')),
  started_at           timestamptz not null default now(),
  due_at               timestamptz not null,
  completed_at         timestamptz,
  created_by           uuid not null default auth.uid() references public.profiles (id),
  created_by_role      public.business_role not null,
  updated_at           timestamptz not null default now()
);
create index interventions_business_idx on public.interventions (business_id, started_at desc);
create trigger interventions_touch before update on public.interventions for each row execute function private.touch_updated_at();
create trigger interventions_audit after insert or update on public.interventions for each row execute function private.audit_row();

create table public.outcomes (
  id               uuid primary key default gen_random_uuid(),
  intervention_id  uuid not null unique references public.interventions (id) on delete cascade,
  business_id      uuid not null references public.businesses (id) on delete cascade,
  metric           text not null,
  baseline_value   numeric not null,
  observed_value   numeric not null,
  delta            numeric not null,
  improved         boolean not null,
  window_start     timestamptz not null,
  window_end       timestamptz not null,
  evidence         jsonb not null default '{}',
  status           public.outcome_status not null default 'observed',
  verified_by      uuid references public.profiles (id),
  verifier_role    public.business_role,
  verified_at      timestamptz,
  verification_note text check (char_length(verification_note) <= 500),
  measured_at      timestamptz not null default now()
);
create index outcomes_business_idx on public.outcomes (business_id, measured_at desc);
create trigger outcomes_audit after insert or update on public.outcomes for each row execute function private.audit_row();

create function private.metric_value(p_business_id uuid, p_metric text) returns numeric
language sql stable security definer set search_path = '' as $$
  select (public.pulse_metrics(p_business_id) ->> p_metric)::numeric;
$$;

-- Operators (partners / program admins) and operators of the business itself can run interventions.
create function public.start_intervention(
  p_business_id uuid, p_title text, p_metric text, p_window_days int default 30,
  p_source_action_id uuid default null, p_solution_version_id uuid default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  r public.business_role := public.my_business_role(p_business_id);
  iid uuid;
begin
  if r is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if private.metric_direction(p_metric) is null then
    raise exception 'Unknown metric %', p_metric using errcode = '22023';
  end if;
  insert into public.interventions (business_id, source_action_id, solution_version_id, title, target_metric, expected_direction,
                                    baseline_value, window_days, due_at, created_by_role)
  values (p_business_id, p_source_action_id, p_solution_version_id, trim(p_title), p_metric, private.metric_direction(p_metric),
          coalesce(private.metric_value(p_business_id, p_metric), 0), p_window_days, now() + make_interval(days => p_window_days), r)
  returning id into iid;
  if p_source_action_id is not null then
    update public.agent_actions set status = 'approved', decided_by = auth.uid(), decided_at = now()
    where id = p_source_action_id and business_id = p_business_id and status = 'proposed';
  end if;
  perform private.emit_event(p_business_id, 'intervention.started', 'intervention', iid,
    jsonb_build_object('title', p_title, 'metric', p_metric));
  return iid;
end $$;

create function public.complete_intervention(p_intervention_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  i public.interventions;
begin
  select * into i from public.interventions where id = p_intervention_id for update;
  if not found or public.my_business_role(i.business_id) is null then
    raise exception 'Not found' using errcode = 'P0002';
  end if;
  if i.status <> 'active' then
    raise exception 'Already %', i.status using errcode = 'P0001';
  end if;
  update public.interventions set status = 'completed', completed_at = now() where id = i.id;
  -- Measure at the end of the window (or now, if the window has already passed).
  perform private.enqueue_job('outcome.measure', i.business_id, jsonb_build_object('intervention_id', i.id),
                              'outcome:' || i.id, greatest(now(), i.due_at));
  perform private.emit_event(i.business_id, 'intervention.completed', 'intervention', i.id, jsonb_build_object('title', i.title));
end $$;

create function public.abandon_intervention(p_intervention_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  i public.interventions;
begin
  select * into i from public.interventions where id = p_intervention_id for update;
  if not found or public.my_business_role(i.business_id) is null then
    raise exception 'Not found' using errcode = 'P0002';
  end if;
  update public.interventions set status = 'abandoned', abandon_reason = p_reason, completed_at = now()
  where id = i.id and status = 'active';
  perform private.emit_event(i.business_id, 'intervention.abandoned', 'intervention', i.id, jsonb_build_object('reason', p_reason));
end $$;

-- Outcomes are verified by someone other than the business's own operators.
create function public.verify_outcome(p_outcome_id uuid, p_verdict text, p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  o public.outcomes;
  r public.business_role;
begin
  select * into o from public.outcomes where id = p_outcome_id for update;
  if not found then
    raise exception 'Not found' using errcode = 'P0002';
  end if;
  r := public.my_business_role(o.business_id);
  if r is null or r not in ('partner', 'program_admin') then
    raise exception 'Outcomes are verified by a partner or program, not the business itself' using errcode = '42501';
  end if;
  if p_verdict not in ('verified', 'disputed') then
    raise exception 'Unknown verdict' using errcode = '22023';
  end if;
  update public.outcomes set status = p_verdict::public.outcome_status, verified_by = auth.uid(), verifier_role = r,
         verified_at = now(), verification_note = p_note
  where id = o.id;
  perform private.emit_event(o.business_id, 'outcome.' || p_verdict, 'outcome', o.id,
    jsonb_build_object('metric', o.metric, 'delta', o.delta, 'improved', o.improved));
end $$;

revoke execute on function public.give_pulse_feedback(uuid, text, date, text, text), public.start_intervention(uuid, text, text, int, uuid, uuid),
  public.complete_intervention(uuid), public.abandon_intervention(uuid, text), public.verify_outcome(uuid, text, text) from public, anon;
grant execute on function public.give_pulse_feedback(uuid, text, date, text, text), public.start_intervention(uuid, text, text, int, uuid, uuid),
  public.complete_intervention(uuid), public.abandon_intervention(uuid, text), public.verify_outcome(uuid, text, text) to authenticated;

-- ─── Activation milestones (from the B4 event log, so operators see the same thing) ──
create function public.activation_status(p_business_id uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$
  with e as (select type, occurred_at from public.events where business_id = p_business_id)
  select jsonb_build_object(
    'created',            (select min(occurred_at) from e where type = 'business.created'),
    'first_capture',      (select min(occurred_at) from e where type = 'capture.received'),
    'first_record',       (select min(occurred_at) from e where type in ('sale.recorded', 'expense.recorded', 'stock.moved')),
    'first_pulse',        (select min(occurred_at) from e where type = 'pulse.computed'),
    'active_days_30',     (select count(distinct occurred_at::date) from e where type in ('sale.recorded', 'expense.recorded', 'stock.moved', 'capture.received')
                             and occurred_at > now() - interval '30 days'),
    'first_intervention', (select min(occurred_at) from e where type = 'intervention.started'),
    'first_completed',    (select min(occurred_at) from e where type = 'intervention.completed'),
    'first_verified_outcome', (select min(occurred_at) from e where type = 'outcome.verified'),
    'first_passport_share', (select min(occurred_at) from e where type = 'passport.shared')
  );
$$;
grant execute on function public.activation_status(uuid) to authenticated;

-- Passport gains verified results (never observed-only ones).
create or replace function public.passport_facts(p_business_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  with b as (select * from public.businesses where id = p_business_id),
  s as (select * from public.sales where business_id = p_business_id and voided_at is null),
  e as (select * from public.expenses where business_id = p_business_id and voided_at is null),
  recs as (select occurred_at, provenance from s union all select occurred_at, provenance from e)
  select jsonb_build_object(
    'name', b.name, 'sector', b.sector, 'country_code', b.country_code, 'currency', b.currency,
    'on_foundry_since', b.created_at,
    'first_record_at', (select min(occurred_at) from recs),
    'months_with_records', (select count(distinct date_trunc('month', occurred_at at time zone b.timezone)) from recs),
    'active_days_90', (select count(distinct (occurred_at at time zone b.timezone)::date) from recs where occurred_at > now() - interval '90 days'),
    'records_180', (select count(*) from recs where occurred_at > now() - interval '180 days'),
    'provenance_180', (select coalesce(jsonb_object_agg(provenance, n), '{}') from (
        select provenance, count(*) n from recs where occurred_at > now() - interval '180 days' group by provenance) x),
    'monthly_sales', (select coalesce(jsonb_agg(jsonb_build_object('month', m, 'sales_minor', total) order by m), '[]') from (
        select to_char(date_trunc('month', occurred_at at time zone b.timezone), 'YYYY-MM') m, sum(total_minor) total
        from s where occurred_at > date_trunc('month', now()) - interval '5 months' group by 1) x),
    'highest_level', (select level from public.verifications v where v.business_id = p_business_id
        order by private.provenance_rank(level) desc limit 1),
    'verifications', (select coalesce(jsonb_agg(jsonb_build_object('level', level, 'method', method, 'subject', subject_type,
        'period_start', period_start, 'period_end', period_end, 'verifier_role', verifier_role, 'at', created_at) order by created_at desc), '[]')
        from (select * from public.verifications v where v.business_id = p_business_id order by created_at desc limit 20) v),
    'verified_outcomes', (select coalesce(jsonb_agg(jsonb_build_object('title', i.title, 'metric', o.metric, 'baseline', o.baseline_value,
        'observed', o.observed_value, 'delta', o.delta, 'verifier_role', o.verifier_role, 'at', o.verified_at) order by o.verified_at desc), '[]')
        from public.outcomes o join public.interventions i on i.id = o.intervention_id
        where o.business_id = p_business_id and o.status = 'verified' and o.improved)
  ) from b;
$$;

-- ─── RLS ──────────────────────────────────────────────────────────────────────
alter table public.business_baselines enable row level security;
alter table public.pulse_feedback enable row level security;
alter table public.interventions enable row level security;
alter table public.outcomes enable row level security;

create policy "baselines: read" on public.business_baselines for select to authenticated using (private.can_read(business_id));
create policy "feedback: read" on public.pulse_feedback for select to authenticated using (private.can_read(business_id));
create policy "interventions: read" on public.interventions for select to authenticated using (private.can_read(business_id));
create policy "outcomes: read" on public.outcomes for select to authenticated using (private.can_read(business_id));
revoke insert, update, delete on public.business_baselines, public.pulse_feedback, public.interventions, public.outcomes from authenticated;
