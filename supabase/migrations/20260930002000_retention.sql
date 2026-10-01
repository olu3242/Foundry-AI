-- B22 Retention: value-based health, disengagement detection, evidence-backed recovery actions,
-- continuation indicators. Reuses B4 events, B7 Pulse, B11 activation/outcomes, B12 operator
-- queue, B21 entitlements. Signals measure business value (records kept, plans done, verified
-- results), not app opens.

create table public.business_health (
  business_id          uuid primary key references public.businesses (id) on delete cascade,
  computed_at          timestamptz not null default now(),
  stage                text not null check (stage in ('new', 'activating', 'active', 'valued')),
  risk                 text not null check (risk in ('healthy', 'watch', 'at_risk', 'dormant')),
  last_activity_at     timestamptz,
  active_days_30       int not null,
  active_days_prev_30  int not null,
  value                jsonb not null,
  reasons              jsonb not null default '[]',
  continuation         text not null check (continuation in ('likely', 'uncertain', 'at_risk', 'not_applicable'))
);

create table public.recovery_actions (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.businesses (id) on delete cascade,
  action_type   text not null check (action_type in ('onboarding_help', 'assist_capture', 'owner_nudge', 'operator_call', 'renewal_check')),
  reason        text not null,
  evidence      jsonb not null,
  status        text not null default 'open' check (status in ('open', 'done', 'dismissed', 'recovered', 'lapsed')),
  note          text,
  created_at    timestamptz not null default now(),
  closed_at     timestamptz,
  closed_by     uuid references public.profiles (id)
);
create unique index recovery_actions_one_open on public.recovery_actions (business_id) where status in ('open', 'done');
create index recovery_actions_business_idx on public.recovery_actions (business_id, created_at);
create trigger recovery_actions_audit after insert or update on public.recovery_actions for each row execute function private.audit_row();

-- Explainable health from real activity. Every reason carries the numbers behind it.
create function private.compute_health(bid uuid) returns public.business_health
language plpgsql stable security definer set search_path = '' as $$
declare
  h public.business_health;
  created timestamptz;
  failed_7 int;
  records_7 int;
  overdue int;
  paid boolean;
  reasons jsonb := '[]';
begin
  select created_at into created from public.businesses where id = bid;
  h.business_id := bid;
  h.computed_at := now();
  select max(occurred_at),
    count(distinct occurred_at::date) filter (where occurred_at > now() - interval '30 days'),
    count(distinct occurred_at::date) filter (where occurred_at <= now() - interval '30 days' and occurred_at > now() - interval '60 days')
  into h.last_activity_at, h.active_days_30, h.active_days_prev_30
  from public.events
  where business_id = bid and type in ('sale.recorded', 'expense.recorded', 'stock.moved', 'capture.received')
    and occurred_at > now() - interval '400 days';
  h.value := jsonb_build_object(
    'confirmed_records_30', (select count(*) from public.events where business_id = bid and type in ('sale.recorded', 'expense.recorded', 'stock.moved') and occurred_at > now() - interval '30 days'),
    'completed_plans', (select count(*) from public.interventions where business_id = bid and status = 'completed'),
    'verified_outcomes', (select count(*) from public.outcomes where business_id = bid and status = 'verified'),
    'improved_outcomes', (select count(*) from public.outcomes where business_id = bid and improved),
    'passport_shares', (select count(*) from public.passport_shares where business_id = bid),
    'active_plan', exists (select 1 from public.interventions where business_id = bid and status = 'active'));
  h.stage := case
    when (h.value ->> 'verified_outcomes')::int > 0 or (h.value ->> 'improved_outcomes')::int > 0 then 'valued'
    when h.active_days_30 >= 4 then 'active'
    when h.last_activity_at is not null then 'activating'
    else 'new' end;

  select count(*) into failed_7 from public.captures where business_id = bid and status = 'failed' and created_at > now() - interval '7 days';
  select count(*) into records_7 from public.events where business_id = bid and type in ('sale.recorded', 'expense.recorded', 'stock.moved') and occurred_at > now() - interval '7 days';
  select count(*) into overdue from public.interventions where business_id = bid and status = 'active' and due_at < now();

  if h.last_activity_at is null and created < now() - interval '3 days' then
    reasons := reasons || jsonb_build_object('code', 'no_first_record', 'detail', 'Nothing recorded since joining', 'days_since_join', extract(day from now() - created)::int);
  end if;
  if h.last_activity_at is not null and h.last_activity_at < now() - interval '7 days' then
    reasons := reasons || jsonb_build_object('code', 'inactive', 'detail', 'No activity for ' || extract(day from now() - h.last_activity_at)::int || ' days',
      'days_inactive', extract(day from now() - h.last_activity_at)::int);
  end if;
  if h.active_days_prev_30 >= 4 and h.active_days_30 * 2 < h.active_days_prev_30 then
    reasons := reasons || jsonb_build_object('code', 'decline', 'detail', 'Active days fell from ' || h.active_days_prev_30 || ' to ' || h.active_days_30,
      'active_days_30', h.active_days_30, 'active_days_prev_30', h.active_days_prev_30);
  end if;
  if failed_7 >= 3 and records_7 = 0 then
    reasons := reasons || jsonb_build_object('code', 'friction', 'detail', failed_7 || ' captures could not be read and nothing was saved this week', 'failed_captures_7', failed_7);
  end if;
  if overdue > 0 then
    reasons := reasons || jsonb_build_object('code', 'plan_overdue', 'detail', overdue || ' plan(s) past their end date', 'overdue_plans', overdue);
  end if;
  h.reasons := reasons;
  h.risk := case
    when (h.last_activity_at is not null and h.last_activity_at < now() - interval '30 days')
      or (h.last_activity_at is null and created < now() - interval '30 days') then 'dormant'
    when (h.last_activity_at is not null and h.last_activity_at < now() - interval '14 days')
      or jsonb_path_exists(reasons, '$[*] ? (@.code == "decline" || @.code == "friction")')
      or (h.last_activity_at is null and created < now() - interval '14 days') then 'at_risk'
    when jsonb_array_length(reasons) > 0 then 'watch'
    else 'healthy' end;

  paid := exists (select 1 from public.entitlements e join public.billing_plans p on p.id = e.plan_id
                  where e.business_id = bid and e.status = 'active' and p.price_minor > 0);
  h.continuation := case
    when not paid then 'not_applicable'
    when h.risk in ('at_risk', 'dormant') then 'at_risk'
    when h.stage in ('valued', 'active') then 'likely'
    else 'uncertain' end;
  return h;
end $$;

-- Daily scan: refresh health, open one recovery action per newly at-risk business, and close the
-- loop when activity resumes (recovered) or the business goes dormant after help (lapsed).
create function public.scan_retention() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  h public.business_health;
  prev text;
  opened int := 0;
  recovered int := 0;
  ra public.recovery_actions;
  top jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not private.is_platform_admin() then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
  for r in select id from public.businesses loop
    h := private.compute_health(r.id);
    select risk into prev from public.business_health where business_id = r.id;
    insert into public.business_health values (h.*)
    on conflict (business_id) do update set computed_at = excluded.computed_at, stage = excluded.stage, risk = excluded.risk,
      last_activity_at = excluded.last_activity_at, active_days_30 = excluded.active_days_30, active_days_prev_30 = excluded.active_days_prev_30,
      value = excluded.value, reasons = excluded.reasons, continuation = excluded.continuation;

    select * into ra from public.recovery_actions where business_id = r.id and status in ('open', 'done');
    if ra.id is not null and h.last_activity_at is not null and h.last_activity_at >= ra.created_at then
      update public.recovery_actions set status = 'recovered', closed_at = now() where id = ra.id;
      perform private.emit_event(r.id, 'retention.recovered', 'recovery_action', ra.id, jsonb_build_object('action_type', ra.action_type));
      recovered := recovered + 1;
    elsif ra.id is not null and ra.created_at < now() - interval '30 days' and h.risk = 'dormant' then
      update public.recovery_actions set status = 'lapsed', closed_at = now() where id = ra.id;
    elsif ra.id is null and h.risk in ('at_risk', 'dormant') and coalesce(prev, 'healthy') not in ('dormant') then
      top := (select x from jsonb_array_elements(h.reasons) x
              order by case x ->> 'code' when 'friction' then 1 when 'decline' then 2 when 'no_first_record' then 3 when 'inactive' then 4 else 5 end limit 1);
      insert into public.recovery_actions (business_id, action_type, reason, evidence)
      values (r.id,
        case when h.continuation = 'at_risk' then 'renewal_check'
             else case top ->> 'code' when 'friction' then 'assist_capture' when 'decline' then 'operator_call'
                                      when 'no_first_record' then 'onboarding_help' else 'owner_nudge' end end,
        coalesce(top ->> 'detail', 'At risk'),
        jsonb_build_object('risk', h.risk, 'stage', h.stage, 'reasons', h.reasons, 'value', h.value,
                           'last_activity_at', h.last_activity_at, 'active_days_30', h.active_days_30, 'continuation', h.continuation))
      returning * into ra;
      perform private.emit_event(r.id, 'retention.at_risk', 'recovery_action', ra.id, jsonb_build_object('risk', h.risk, 'action_type', ra.action_type));
      opened := opened + 1;
    end if;
  end loop;
  return jsonb_build_object('opened', opened, 'recovered', recovered);
end $$;

-- Operators (and owners) close actions; resolution stays "done" until activity proves recovery.
create function public.close_recovery_action(p_id uuid, p_status text, p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  ra public.recovery_actions;
begin
  select * into ra from public.recovery_actions where id = p_id;
  if not found or not (private.can_write(ra.business_id) or private.program_role_for(ra.business_id) is not null or private.is_platform_admin()) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_status not in ('done', 'dismissed') then
    raise exception 'Status must be done or dismissed' using errcode = '22023';
  end if;
  update public.recovery_actions set status = p_status, note = p_note, closed_at = case when p_status = 'dismissed' then now() end,
    closed_by = auth.uid() where id = p_id and status = 'open';
end $$;

create function public.retention_overview() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_platform_admin() then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'risk', (select coalesce(jsonb_object_agg(risk, n), '{}') from (select risk, count(*) n from public.business_health group by risk) x),
    'stage', (select coalesce(jsonb_object_agg(stage, n), '{}') from (select stage, count(*) n from public.business_health group by stage) x),
    'continuation', (select coalesce(jsonb_object_agg(continuation, n), '{}') from (select continuation, count(*) n from public.business_health group by continuation) x),
    'recovery', (select coalesce(jsonb_agg(x), '[]') from (
      select action_type, count(*) n, count(*) filter (where status = 'recovered') recovered, count(*) filter (where status = 'lapsed') lapsed,
        count(*) filter (where status in ('open', 'done')) open,
        round(count(*) filter (where status = 'recovered')::numeric / nullif(count(*) filter (where status in ('recovered', 'lapsed', 'dismissed')), 0), 3) recovery_rate
      from public.recovery_actions group by action_type order by action_type) x)
  );
end $$;

revoke execute on function public.scan_retention(), public.close_recovery_action(uuid, text, text), public.retention_overview() from public, anon;
grant execute on function public.scan_retention(), public.close_recovery_action(uuid, text, text), public.retention_overview() to authenticated;

-- Operator queue (B12) gains evidence-backed recovery items; the plain "inactive" item yields to them.
create or replace function private.operator_items(p_user uuid) returns table (
  item_key text, business_id uuid, business_name text, kind text, severity int, title text, detail text, since timestamptz, link text
)
language sql stable security definer set search_path = '' as $$
  with p as (select private.my_portfolio() as bid),
  b as (select id, name from public.businesses where id in (select bid from p)),
  latest as (
    select distinct on (s.business_id) s.business_id, s.computed_on from public.pulse_snapshots s
    where s.business_id in (select id from b) order by s.business_id, s.computed_on desc
  ),
  risk as (
    select s.business_id, count(*) filter (where s.state = 'at_risk') n, min(s.computed_at) since
    from public.pulse_snapshots s join latest l on l.business_id = s.business_id and l.computed_on = s.computed_on
    group by s.business_id
  ),
  last_record as (
    select e.business_id, max(e.occurred_at) at from public.events e
    where e.business_id in (select id from b) and e.type in ('sale.recorded', 'expense.recorded', 'stock.moved', 'capture.received')
    group by e.business_id
  ),
  recovery as (select * from public.recovery_actions where business_id in (select id from b) and status = 'open'),
  items as (
    select 'verify:' || o.id, o.business_id, 'outcome_to_verify', 70, 'Result waiting for your check',
           'A plan ended and its result was measured.', o.measured_at, '/progress'
    from public.outcomes o where o.business_id in (select id from b) and o.status = 'observed'
    union all
    select 'recover:' || ra.id, ra.business_id, 'recovery', case when ra.evidence ->> 'risk' = 'dormant' then 68 else 62 end,
           'Recovery: ' || replace(ra.action_type, '_', ' '), ra.reason, ra.created_at, ''
    from recovery ra
    union all
    select 'risk:' || r.business_id, r.business_id, 'pulse_at_risk', 60 + 5 * r.n::int, r.n || ' Pulse signal(s) need attention',
           'Latest Pulse has at-risk signals.', r.since, '/pulse'
    from risk r where r.n > 0
    union all
    select 'overdue:' || i.id, i.business_id, 'plan_overdue', 55, 'Plan past its end date', i.title, i.due_at, '/progress'
    from public.interventions i where i.business_id in (select id from b) and i.status = 'active' and i.due_at < now()
    union all
    select 'inactive:' || b.id, b.id, 'inactive', 50, 'No records for a week',
           coalesce('Last record ' || to_char(lr.at, 'DD Mon'), 'Nothing recorded yet'), coalesce(lr.at, now()), ''
    from b left join last_record lr on lr.business_id = b.id
    where (lr.at is null or lr.at < now() - interval '7 days') and not exists (select 1 from recovery ra where ra.business_id = b.id)
    union all
    select 'noplan:' || r.business_id, r.business_id, 'no_plan', 45, 'At risk with no plan running', 'Start a plan with the owner.', r.since, '/progress'
    from risk r where r.n > 0 and not exists (select 1 from public.interventions i where i.business_id = r.business_id and i.status = 'active')
    union all
    select 'captures:' || c.business_id, c.business_id, 'failed_captures', 40, count(*) || ' capture(s) could not be read',
           'Help the owner enter them by hand.', min(c.created_at), ''
    from public.captures c where c.business_id in (select id from b) and c.status = 'failed' and c.created_at > now() - interval '7 days'
    group by c.business_id
  )
  select i.item_key, i.business_id, b.name, i.kind, i.severity, i.title, i.detail, i.since, i.link
  from items i (item_key, business_id, kind, severity, title, detail, since, link)
  join b on b.id = i.business_id
  where not exists (select 1 from public.operator_snoozes z where z.user_id = p_user and z.item_key = i.item_key and z.until > now())
$$;

alter table public.business_health enable row level security;
alter table public.recovery_actions enable row level security;
create policy "health: readers" on public.business_health for select to authenticated using (private.can_read(business_id) or private.is_platform_admin());
create policy "recovery: readers" on public.recovery_actions for select to authenticated using (private.can_read(business_id) or private.is_platform_admin());
revoke insert, update, delete on public.business_health, public.recovery_actions from authenticated;
