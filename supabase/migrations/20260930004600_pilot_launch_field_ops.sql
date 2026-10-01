-- B52 Real pilot launch + B53 Operator field OS (deltas over B45 pilots, B23 escalations/agent actions,
-- B12 operator surfaces). INVITE → CONSENT → ONBOARD → QUALIFY → ASSIGN OPERATOR → BASELINE is now
-- explicit per business, and operator effort is captured so leverage (AI vs human work, minutes and
-- touches per business, response time) is measured, not assumed.

-- ─── B52: qualification, operator assignment, baseline ────────────────────────
alter table public.pilot_businesses
  add column qualified_at timestamptz,
  add column operator_id uuid references public.profiles (id) on delete set null,
  add column operator_assigned_at timestamptz,
  add column baseline jsonb,
  add column baseline_at timestamptz;
create index pilot_businesses_operator_idx on public.pilot_businesses (operator_id);

-- Least-loaded operator of the pilot (ties → earliest added), or null when the pilot has none yet.
create function private.pick_pilot_operator(p_pilot_id uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select o.user_id from public.pilot_operators o
  where o.pilot_id = p_pilot_id and o.role = 'operator'
  order by (select count(*) from public.pilot_businesses pb where pb.pilot_id = p_pilot_id and pb.operator_id = o.user_id), o.user_id
  limit 1;
$$;

-- Baseline: what the business looked like when it entered (native currency; unknown stays null).
create function private.pilot_baseline(p_business_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'sales_30', private.metric_value(p_business_id, 'sales_30'),
    'expenses_30', private.metric_value(p_business_id, 'expenses_30'),
    'records_30', (select count(*) from public.events where business_id = p_business_id and type in ('sale.recorded', 'expense.recorded', 'pack.recorded')
                   and occurred_at > now() - interval '30 days'),
    'currency', (select currency from public.businesses where id = p_business_id),
    'taken_at', now());
$$;

-- Eligible entrants are qualified, assigned an operator and baselined on entry.
create function private.launch_pilot_business() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.eligible then
    new.qualified_at := coalesce(new.qualified_at, now());
    new.operator_id := coalesce(new.operator_id, private.pick_pilot_operator(new.pilot_id));
    new.operator_assigned_at := case when new.operator_id is not null then coalesce(new.operator_assigned_at, now()) end;
    new.baseline := coalesce(new.baseline, private.pilot_baseline(new.business_id));
    new.baseline_at := coalesce(new.baseline_at, now());
  end if;
  return new;
end $$;
create trigger pilot_businesses_launch before insert on public.pilot_businesses for each row execute function private.launch_pilot_business();

-- Operators added after businesses joined pick up the unassigned ones (daily worker and on demand).
create function public.assign_pilot_operators(p_pilot_id uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare
  pb record;
  n int := 0;
  op uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not private.is_platform_admin() then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
  for pb in select business_id from public.pilot_businesses where pilot_id = p_pilot_id and eligible and operator_id is null order by joined_at loop
    op := private.pick_pilot_operator(p_pilot_id);
    exit when op is null;
    update public.pilot_businesses set operator_id = op, operator_assigned_at = now() where pilot_id = p_pilot_id and business_id = pb.business_id;
    n := n + 1;
  end loop;
  return n;
end $$;

create function public.reassign_pilot_business(p_pilot_id uuid, p_business_id uuid, p_operator uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.can_see_pilot(p_pilot_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if not exists (select 1 from public.pilot_operators where pilot_id = p_pilot_id and user_id = p_operator and role = 'operator') then
    raise exception 'That person is not an operator on this pilot' using errcode = 'P0001';
  end if;
  update public.pilot_businesses set operator_id = p_operator, operator_assigned_at = now() where pilot_id = p_pilot_id and business_id = p_business_id;
end $$;

-- ─── B53: operator effort ─────────────────────────────────────────────────────
create table public.operator_touches (
  id               uuid primary key default gen_random_uuid(),
  pilot_id         uuid not null references public.pilots (id) on delete cascade,
  business_id      uuid not null references public.businesses (id) on delete cascade,
  operator_id      uuid not null default auth.uid() references public.profiles (id),
  kind             text not null check (kind in ('call', 'visit', 'message', 'record_help', 'confirmation', 'pulse_review', 'intervention_support',
                                                 'verification', 'escalation', 'payment_help', 'other')),
  minutes          int not null check (minutes between 0 and 600),
  resolved         boolean not null default true,
  escalation_id    uuid references public.escalations (id) on delete set null,
  intervention_id  uuid references public.interventions (id) on delete set null,
  note             text check (char_length(note) <= 1000),
  created_at       timestamptz not null default now()
);
create index operator_touches_pilot_idx on public.operator_touches (pilot_id, created_at desc);
create index operator_touches_business_idx on public.operator_touches (business_id);
create index operator_touches_operator_idx on public.operator_touches (operator_id);

create function public.log_operator_touch(p_pilot_id uuid, p_business_id uuid, p_kind text, p_minutes int, p_note text default null,
  p_escalation_id uuid default null, p_intervention_id uuid default null, p_resolved boolean default true) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  tid uuid;
begin
  if not (exists (select 1 from public.pilot_operators where pilot_id = p_pilot_id and user_id = auth.uid()) or private.is_platform_admin()) then
    raise exception 'Pilot operators only' using errcode = '42501';
  end if;
  if not exists (select 1 from public.pilot_businesses where pilot_id = p_pilot_id and business_id = p_business_id) then
    raise exception 'That business is not in this pilot' using errcode = 'P0002';
  end if;
  insert into public.operator_touches (pilot_id, business_id, kind, minutes, note, escalation_id, intervention_id, resolved)
  values (p_pilot_id, p_business_id, p_kind, p_minutes, nullif(trim(p_note), ''), p_escalation_id, p_intervention_id, coalesce(p_resolved, true))
  returning id into tid;
  if p_escalation_id is not null and coalesce(p_resolved, true) then
    update public.escalations set status = 'resolved', resolved_at = now(), resolved_by = auth.uid()
    where id = p_escalation_id and business_id = p_business_id and status = 'open';
  end if;
  return tid;
end $$;

-- One operational surface: every item needing a person, per business in the operator's portfolio.
create function public.operator_portfolio(p_pilot_id uuid, p_operator uuid default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  op uuid := coalesce(p_operator, auth.uid());
begin
  if not private.can_see_pilot(p_pilot_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return (select coalesce(jsonb_agg(x order by (x ->> 'attention')::int desc, x ->> 'name'), '[]') from (
    select jsonb_build_object('business_id', b.id, 'name', b.name, 'class', b.data_class, 'stage', pb.stage, 'at_risk', pb.at_risk,
      'days_since_record', (select extract(day from now() - max(e.occurred_at))::int from public.events e
                            where e.business_id = b.id and e.type in ('sale.recorded', 'expense.recorded', 'pack.recorded')),
      'unconfirmed_drafts', (select count(*) from public.record_drafts d where d.business_id = b.id and d.status = 'proposed'),
      'pulse_alerts', (select count(*) from public.pulse_snapshots s where s.business_id = b.id and s.state in ('at_risk', 'watch')
                       and s.computed_on = (select max(computed_on) from public.pulse_snapshots s2 where s2.business_id = b.id)),
      'open_escalations', (select count(*) from public.escalations es where es.business_id = b.id and es.status = 'open'),
      'active_interventions', (select count(*) from public.interventions i where i.business_id = b.id and i.status = 'active'),
      'outcomes_to_verify', (select count(*) from public.outcomes o where o.business_id = b.id and o.status = 'observed'),
      'last_touch_at', (select max(created_at) from public.operator_touches t where t.business_id = b.id and t.pilot_id = p_pilot_id),
      'attention', (case when pb.at_risk then 3 else 0 end)
                   + (select count(*) from public.escalations es where es.business_id = b.id and es.status = 'open')
                   + (select count(*) from public.outcomes o where o.business_id = b.id and o.status = 'observed')
                   + least((select count(*) from public.record_drafts d where d.business_id = b.id and d.status = 'proposed'), 3)) x
    from public.pilot_businesses pb join public.businesses b on b.id = pb.business_id
    where pb.pilot_id = p_pilot_id and pb.eligible
      and (pb.operator_id = op or (p_operator is null and private.is_platform_admin()))   -- admins see the whole cohort
  ) s);
end $$;

-- Leverage: who resolved the work, how long it took, how much operator time each business needed.
create function private.pilot_operations(p_pilot_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  with pb as (select pb.* from public.pilot_businesses pb where pb.pilot_id = p_pilot_id and pb.eligible),
       t as (select * from public.operator_touches where pilot_id = p_pilot_id),
       ai as (select a.* from public.agent_actions a join pb on pb.business_id = a.business_id
              where a.source = 'ops-automation' and a.status = 'executed' and a.created_at >= pb.joined_at),
       es as (select e.* from public.escalations e join pb on pb.business_id = e.business_id where e.created_at >= pb.joined_at)
  select jsonb_build_object(
    'operators', (select count(*) from public.pilot_operators where pilot_id = p_pilot_id and role = 'operator'),
    'businesses_per_operator', round((select count(*) from pb)::numeric / nullif((select count(*) from public.pilot_operators where pilot_id = p_pilot_id and role = 'operator'), 0), 1),
    'unassigned', (select count(*) from pb where operator_id is null),
    'touches', (select count(*) from t),
    'operator_minutes', (select coalesce(sum(minutes), 0) from t),
    'minutes_per_business', round((select coalesce(sum(minutes), 0) from t)::numeric / nullif((select count(*) from pb), 0), 1),
    'touches_per_business', round((select count(*) from t)::numeric / nullif((select count(*) from pb), 0), 2),
    'ai_resolved', (select count(*) from ai),
    'human_resolved', (select count(*) from t where resolved) + (select count(*) from es where status = 'resolved' and not exists (select 1 from t where t.escalation_id = es.id)),
    'escalations', (select count(*) from es),
    'open_escalations', (select count(*) from es where status = 'open'),
    'median_response_hours', (select round(percentile_cont(0.5) within group (order by extract(epoch from resolved_at - created_at) / 3600)::numeric, 1) from es where resolved_at is not null),
    'by_kind', (select coalesce(jsonb_object_agg(kind, m), '{}') from (select kind, sum(minutes) m from t group by 1) k));
$$;

-- ─── Grants and RLS ───────────────────────────────────────────────────────────
revoke execute on function public.assign_pilot_operators(uuid), public.reassign_pilot_business(uuid, uuid, uuid),
  public.log_operator_touch(uuid, uuid, text, int, text, uuid, uuid, boolean), public.operator_portfolio(uuid, uuid) from public, anon;
grant execute on function public.assign_pilot_operators(uuid), public.reassign_pilot_business(uuid, uuid, uuid),
  public.log_operator_touch(uuid, uuid, text, int, text, uuid, uuid, boolean), public.operator_portfolio(uuid, uuid) to authenticated, service_role;

alter table public.operator_touches enable row level security;
create policy "touches: pilot viewers" on public.operator_touches for select to authenticated using (private.can_see_pilot(pilot_id));
revoke insert, update, delete on public.operator_touches from authenticated, anon;
