-- B23 Autonomous operations: bounded routine work runs on its own under the B9 autonomy levels.
-- Reuses agent_runs/agent_actions (B9), events (B4), outcomes/interventions (B11), program
-- partners (B10), operator queue (B12), recovery (B22). Every automated step records the
-- authority it acted under and its evidence; anything outside policy escalates to a person.

alter table public.autonomy_policies drop constraint autonomy_policies_action_type_check;
alter table public.autonomy_policies add constraint autonomy_policies_action_type_check check (action_type in (
  'capture.record', 'growth.recommend', 'customer.reminder', 'stock.alert', 'market.match',
  'ops.record_request', 'ops.plan_reminder'));

-- Program-level authority for routing work to partners (off by default: a person assigns).
alter table public.programs add column auto_route boolean not null default false;

create table public.escalations (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null references public.businesses (id) on delete cascade,
  program_id        uuid references public.programs (id) on delete cascade,
  kind              text not null check (kind in ('assign_verifier', 'ignored_requests', 'automation_failed')),
  reason            text not null,
  evidence          jsonb not null default '{}',
  source_action_id  uuid references public.agent_actions (id) on delete set null,
  dedupe_key        text not null unique,
  status            text not null default 'open' check (status in ('open', 'resolved')),
  created_at        timestamptz not null default now(),
  resolved_at       timestamptz,
  resolved_by       uuid references public.profiles (id)
);
create index escalations_business_idx on public.escalations (business_id, status);
create index escalations_program_idx on public.escalations (program_id) where status = 'open';
create trigger escalations_audit after insert or update on public.escalations for each row execute function private.audit_row();

-- Level in force = owner's choice (or default), capped by the action's safe maximum.
-- Mirrors lib/autonomy/policy.ts effectiveLevel/modeFor.
create function private.ops_level(bid uuid, action text, dflt int, cap int) returns int
language sql stable security definer set search_path = '' as $$
  select greatest(0, least(coalesce((select level from public.autonomy_policies where business_id = bid and action_type = action), dflt), cap));
$$;

create function private.ops_act(bid uuid, run uuid, action text, lvl int, cap int, ttl text, bdy text, dedupe text, evidence jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  aid uuid;
  mode text := case when lvl = 0 then 'skip' when lvl = 1 then 'suggest' when lvl <= 3 then 'await_approval' else 'auto_notify' end;
begin
  if mode = 'skip' or exists (select 1 from public.agent_actions where business_id = bid and action_type = action and dedupe_key = dedupe) then
    return null;
  end if;
  insert into public.agent_actions (business_id, agent_run_id, action_type, autonomy_level, title, body, payload, source, dedupe_key, status, executed_at, generator)
  values (bid, run, action, lvl, ttl, bdy,
    jsonb_build_object('authority', jsonb_build_object('level', lvl, 'max_level', cap, 'mode', mode,
        'policy', case when exists (select 1 from public.autonomy_policies where business_id = bid and action_type = action) then 'owner' else 'default' end,
        'channel', 'in_app'),
      'evidence', evidence),
    'ops-automation', dedupe,
    case when mode = 'auto_notify' then 'executed'::public.action_status else 'proposed'::public.action_status end,
    case when mode = 'auto_notify' then now() end, 'ops-v1')
  returning id into aid;
  perform private.emit_event(bid, 'ops.' || case when mode = 'auto_notify' then 'executed' else 'proposed' end, 'agent_action', aid,
    jsonb_build_object('action_type', action, 'level', lvl));
  return aid;
end $$;

create function private.ops_escalate(bid uuid, pid uuid, k text, why text, ev jsonb, src uuid, dedupe text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  eid uuid;
begin
  insert into public.escalations (business_id, program_id, kind, reason, evidence, source_action_id, dedupe_key)
  values (bid, pid, k, why, ev, src, dedupe) on conflict (dedupe_key) do nothing returning id into eid;
  if eid is not null then
    perform private.emit_event(bid, 'ops.escalated', 'escalation', eid, jsonb_build_object('kind', k));
  end if;
  return eid;
end $$;

-- One pass of routine operations. Idempotent via dedupe keys; safe to run hourly or daily.
create function public.run_routine_ops(p_business_id uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  b record;
  r record;
  run uuid;
  lvl int;
  last_rec timestamptz;
  acted int := 0;
  escalated int := 0;
  routed int := 0;
  aid uuid;
  partner uuid;
  wk text := to_char(now(), 'IYYY-IW');
begin
  if coalesce(auth.role(), '') <> 'service_role' and not private.is_platform_admin() then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
  for b in select id from public.businesses where p_business_id is null or id = p_business_id loop
    run := null;
    select max(occurred_at) into last_rec from public.events
    where business_id = b.id and type in ('sale.recorded', 'expense.recorded', 'stock.moved', 'capture.received');

    -- 1. Record request: active in the last 30 days but nothing for 3+ days (dormancy is B22's job).
    if last_rec between now() - interval '30 days' and now() - interval '3 days' then
      lvl := private.ops_level(b.id, 'ops.record_request', 4, 4);
      insert into public.agent_runs (business_id, agent, trigger, model, status, output) values (b.id, 'ops-automation', 'schedule', 'rules:ops-v1', 'succeeded', '{}') returning id into run;
      aid := private.ops_act(b.id, run, 'ops.record_request', lvl, 4, 'Catch up on the last few days',
        'Nothing has been recorded since ' || to_char(last_rec, 'DD Mon') || '. Say or type what you sold and spent — it takes a minute.',
        'rr:' || wk, jsonb_build_object('last_record_at', last_rec, 'days_without_records', extract(day from now() - last_rec)::int));
      if aid is not null then acted := acted + 1; end if;
      -- Unusual: three requests in three weeks without a record → a person follows up.
      if (select count(*) from public.agent_actions where business_id = b.id and action_type = 'ops.record_request' and created_at > now() - interval '21 days' and created_at > last_rec) >= 3 then
        for r in select e.program_id from public.program_enrollments e where e.business_id = b.id and e.status = 'active' loop
          if private.ops_escalate(b.id, r.program_id, 'ignored_requests', 'Three record requests went unanswered',
               jsonb_build_object('last_record_at', last_rec), aid, 'ignored:' || b.id || ':' || wk) is not null then escalated := escalated + 1; end if;
        end loop;
      end if;
    end if;

    -- 2. Plan reminder: an active plan ends within two days.
    for r in select id, title, due_at from public.interventions where business_id = b.id and status = 'active' and due_at between now() and now() + interval '2 days' loop
      lvl := private.ops_level(b.id, 'ops.plan_reminder', 4, 4);
      if run is null then
        insert into public.agent_runs (business_id, agent, trigger, model, status, output) values (b.id, 'ops-automation', 'schedule', 'rules:ops-v1', 'succeeded', '{}') returning id into run;
      end if;
      aid := private.ops_act(b.id, run, 'ops.plan_reminder', lvl, 4, 'Your plan "' || left(r.title, 80) || '" ends ' || to_char(r.due_at, 'DD Mon'),
        'Mark it done when you have finished so Foundry can measure the result.', 'pr:' || r.id,
        jsonb_build_object('intervention_id', r.id, 'due_at', r.due_at));
      if aid is not null then acted := acted + 1; end if;
    end loop;

    -- 3. Verification routing: a measured result waits 3+ days for a partner's check.
    for r in select o.id outcome_id, e.program_id, p.auto_route from public.outcomes o
             join public.program_enrollments e on e.business_id = o.business_id and e.status = 'active'
             join public.programs p on p.id = e.program_id
             where o.business_id = b.id and o.status = 'observed' and o.measured_at < now() - interval '3 days'
               and not exists (select 1 from public.partner_assignments a where a.program_id = e.program_id and a.business_id = o.business_id) loop
      partner := null;
      if r.auto_route then
        select m.user_id into partner from public.program_members m
        where m.program_id = r.program_id and m.role = 'partner'
        order by (select count(*) from public.partner_assignments a where a.partner_user_id = m.user_id), m.user_id limit 1;
      end if;
      if partner is not null then
        insert into public.partner_assignments (program_id, partner_user_id, business_id) values (r.program_id, partner, b.id) on conflict do nothing;
        if run is null then
          insert into public.agent_runs (business_id, agent, trigger, model, status, output) values (b.id, 'ops-automation', 'schedule', 'rules:ops-v1', 'succeeded', '{}') returning id into run;
        end if;
        insert into public.agent_actions (business_id, agent_run_id, action_type, autonomy_level, title, body, payload, source, dedupe_key, status, executed_at, generator)
        values (b.id, run, 'ops.route_verifier', 4, 'A partner was assigned to check your result', 'They can now verify it.',
          jsonb_build_object('authority', jsonb_build_object('level', 4, 'mode', 'auto_notify', 'policy', 'program.auto_route', 'program_id', r.program_id),
            'evidence', jsonb_build_object('outcome_id', r.outcome_id), 'effect', jsonb_build_object('program_id', r.program_id, 'partner_user_id', partner, 'business_id', b.id), 'reversible', true),
          'ops-automation', 'route:' || r.outcome_id, 'executed', now(), 'ops-v1')
        on conflict do nothing;
        routed := routed + 1;
      elsif private.ops_escalate(b.id, r.program_id, 'assign_verifier', 'A measured result needs a partner to verify it',
              jsonb_build_object('outcome_id', r.outcome_id, 'auto_route', r.auto_route), null, 'verify:' || r.outcome_id || ':' || r.program_id) is not null then
        escalated := escalated + 1;
      end if;
    end loop;
  end loop;
  return jsonb_build_object('acted', acted, 'routed', routed, 'escalated', escalated);
end $$;

-- Undo an automated reversible step (program admins for routing).
create function public.revert_ops_action(p_action_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  a public.agent_actions;
begin
  select * into a from public.agent_actions where id = p_action_id;
  if not found or a.action_type <> 'ops.route_verifier' or a.status <> 'executed' then
    raise exception 'Only executed, reversible automation can be undone' using errcode = 'P0001';
  end if;
  if not private.is_program_member((a.payload -> 'effect' ->> 'program_id')::uuid, array['admin']::public.program_role[]) then
    raise exception 'Program admins only' using errcode = '42501';
  end if;
  delete from public.partner_assignments where program_id = (a.payload -> 'effect' ->> 'program_id')::uuid
    and partner_user_id = (a.payload -> 'effect' ->> 'partner_user_id')::uuid and business_id = a.business_id;
  update public.agent_actions set status = 'failed', result = jsonb_build_object('reverted_by', auth.uid(), 'reverted_at', now()) where id = a.id;
  perform private.emit_event(a.business_id, 'ops.reverted', 'agent_action', a.id, jsonb_build_object('action_type', a.action_type));
end $$;

create function public.resolve_escalation(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  e public.escalations;
begin
  select * into e from public.escalations where id = p_id;
  if not found or not ((e.program_id is not null and private.is_program_member(e.program_id)) or private.is_platform_admin()) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  update public.escalations set status = 'resolved', resolved_at = now(), resolved_by = auth.uid() where id = p_id and status = 'open';
end $$;

create function public.set_program_auto_route(p_program_id uuid, p_on boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_program_member(p_program_id, array['admin']::public.program_role[]) then
    raise exception 'Program admins only' using errcode = '42501';
  end if;
  update public.programs set auto_route = p_on where id = p_program_id;
end $$;

create function public.automation_overview(p_days int default 30) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_platform_admin() then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'actions', (select coalesce(jsonb_agg(x), '[]') from (
      select action_type, count(*) n, count(*) filter (where status = 'executed') executed, count(*) filter (where status = 'proposed') awaiting,
        count(*) filter (where status = 'failed') reverted
      from public.agent_actions where source = 'ops-automation' and created_at > now() - make_interval(days => p_days) group by action_type order by 1) x),
    'escalations', (select coalesce(jsonb_object_agg(kind || ':' || status, n), '{}') from (
      select kind, status, count(*) n from public.escalations where created_at > now() - make_interval(days => p_days) group by 1, 2) x),
    -- Leverage: routine steps done without a person per escalation raised.
    'automation_ratio', (select round(count(*) filter (where status = 'executed')::numeric / nullif((select count(*) from public.escalations where created_at > now() - make_interval(days => p_days)), 0), 2)
      from public.agent_actions where source = 'ops-automation' and created_at > now() - make_interval(days => p_days))
  );
end $$;

revoke execute on function public.run_routine_ops(uuid), public.revert_ops_action(uuid), public.resolve_escalation(uuid),
  public.set_program_auto_route(uuid, boolean), public.automation_overview(int) from public, anon;
grant execute on function public.run_routine_ops(uuid), public.revert_ops_action(uuid), public.resolve_escalation(uuid),
  public.set_program_auto_route(uuid, boolean), public.automation_overview(int) to authenticated;

-- Operator queue gains escalations routed to the operator's programs.
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
    select 'escalate:' || x.id, x.business_id, 'escalation', 72, 'Escalated: ' || replace(x.kind, '_', ' '), x.reason, x.created_at, ''
    from public.escalations x
    where x.status = 'open' and x.business_id in (select id from b)
      and x.program_id in (select program_id from public.program_members where user_id = p_user)
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

alter table public.escalations enable row level security;
create policy "escalations: business, program, admins" on public.escalations for select to authenticated using (
  private.can_read(business_id) or (program_id is not null and private.is_program_member(program_id)) or private.is_platform_admin());
revoke insert, update, delete on public.escalations from authenticated;
