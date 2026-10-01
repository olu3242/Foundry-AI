-- B36 Partner performance: volume, completion, turnaround, evidence quality, outcomes,
-- reliability and disputes for program partners, providers and verifiers — used internally for
-- governance and routing (documented formula), never as a public ranking.
-- Reuses B10 partner assignments, B11 outcomes, B15 programs, B17 engagements, B23 routing/escalations, B24 attestations.

alter table public.program_members add column capabilities text[] not null default '{}'
  check (capabilities <@ array['verification', 'bookkeeping', 'sales', 'finance_readiness', 'field_visits']::text[]);

create function public.set_partner_capabilities(p_program_id uuid, p_user_id uuid, p_capabilities text[]) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_program_member(p_program_id, array['admin']::public.program_role[]) then
    raise exception 'Program admins only' using errcode = '42501';
  end if;
  update public.program_members set capabilities = p_capabilities where program_id = p_program_id and user_id = p_user_id;
end $$;

-- Program partner metrics (null where not applicable; samples always shown).
create function private.program_partner_metrics(p_program_id uuid, p_user_id uuid, p_days int) returns jsonb
language sql stable security definer set search_path = '' as $$
  with biz as (select business_id from public.partner_assignments where program_id = p_program_id and partner_user_id = p_user_id),
  plans as (select * from public.interventions where business_id in (select business_id from biz) and started_at > now() - make_interval(days => p_days)),
  ver as (select o.* from public.outcomes o where o.verified_by = p_user_id and o.verified_at > now() - make_interval(days => p_days)),
  esc as (select * from public.escalations where program_id = p_program_id and resolved_by = p_user_id and resolved_at > now() - make_interval(days => p_days))
  select jsonb_build_object(
    'volume', (select count(*) from biz),
    'plans', (select count(*) from plans),
    'completion_rate', (select round(count(*) filter (where status = 'completed')::numeric / nullif(count(*) filter (where status <> 'active'), 0), 3) from plans),
    'verifications', (select count(*) from ver),
    'verify_turnaround_hours', (select round((percentile_cont(0.5) within group (order by extract(epoch from verified_at - measured_at) / 3600))::numeric, 1) from ver),
    'improved_rate', (select round(count(*) filter (where improved)::numeric / nullif(count(*), 0), 3) from ver),
    'escalations_resolved', (select count(*) from esc),
    'escalation_hours', (select round((percentile_cont(0.5) within group (order by extract(epoch from resolved_at - created_at) / 3600))::numeric, 1) from esc),
    'disputed', (select count(*) from public.outcomes where business_id in (select business_id from biz) and status = 'disputed'));
$$;

create function private.provider_metrics(p_provider_id uuid, p_days int) returns jsonb
language sql stable security definer set search_path = '' as $$
  with e as (select g.*, i.status istatus from public.solution_engagements g join public.interventions i on i.id = g.intervention_id
             where g.provider_id = p_provider_id and g.consented_at > now() - make_interval(days => p_days)),
  o as (select o.* from public.outcomes o where o.intervention_id in (select intervention_id from e))
  select jsonb_build_object(
    'volume', (select count(*) from e),
    'completion_rate', (select round(count(*) filter (where istatus = 'completed')::numeric / nullif(count(*) filter (where istatus <> 'active'), 0), 3) from e),
    'first_update_hours', (select round((percentile_cont(0.5) within group (order by extract(epoch from u.first_at - e.consented_at) / 3600))::numeric, 1)
                           from e join lateral (select min(created_at) first_at from public.engagement_updates where engagement_id = e.id) u on u.first_at is not null),
    'updates_per_engagement', (select round(count(*)::numeric / nullif((select count(*) from e), 0), 2) from public.engagement_updates where engagement_id in (select id from e)),
    'improved_rate', (select round(count(*) filter (where improved)::numeric / nullif(count(*), 0), 3) from o),
    'verified_improved', (select count(*) from o where improved and status = 'verified'),
    'disputed', (select count(*) from o where status = 'disputed'));
$$;

create function private.verifier_metrics(p_verifier_id uuid, p_days int) returns jsonb
language sql stable security definer set search_path = '' as $$
  with a as (select a.*, r.created_at requested_at from public.attestations a join public.verification_requests r on r.id = a.request_id
             where a.verifier_id = p_verifier_id and a.attested_at > now() - make_interval(days => p_days))
  select jsonb_build_object(
    'volume', (select count(*) from a),
    'open_requests', (select count(*) from public.verification_requests where verifier_id = p_verifier_id and status = 'requested'),
    'turnaround_hours', (select round((percentile_cont(0.5) within group (order by extract(epoch from attested_at - requested_at) / 3600))::numeric, 1) from a where supersedes is null),
    'evidence_quality', (select round(1 - count(*) filter (where status in ('corrected', 'revoked'))::numeric / nullif(count(*), 0), 3) from a),
    'disputes', (select count(*) from public.attestation_disputes d where d.attestation_id in (select id from a)),
    'disputes_upheld', (select count(*) from public.attestation_disputes d where d.attestation_id in (select id from a) and d.status = 'upheld'));
$$;

-- Governance view. Program admins see their own program's partners; platform admins see all.
create function public.partner_performance(p_days int default 90, p_program_id uuid default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (private.is_platform_admin() or (p_program_id is not null and private.is_program_member(p_program_id, array['admin']::public.program_role[]))) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'note', 'For governance and routing only. Not a public ranking; small samples are shown as such.',
    'program_partners', (select coalesce(jsonb_agg(jsonb_build_object('program_id', m.program_id, 'user_id', m.user_id,
        'name', coalesce(p.full_name, p.phone, p.email), 'capabilities', m.capabilities) || private.program_partner_metrics(m.program_id, m.user_id, p_days)), '[]')
      from public.program_members m join public.profiles p on p.id = m.user_id
      where m.role = 'partner' and (p_program_id is null or m.program_id = p_program_id)),
    'providers', case when p_program_id is null then (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'kind', kind) || private.provider_metrics(id, p_days)), '[]')
      from public.providers where status = 'approved') end,
    'verifiers', case when p_program_id is null then (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'kind', kind) || private.verifier_metrics(id, p_days)), '[]')
      from public.verifiers where status = 'approved') end);
end $$;

-- Routing: documented capability + history + load score.
--   score = capability (1 declared, 0.5 undeclared, 0 other) × 1 / (1 + median verify days) × 1 / (1 + 0.1 × assigned businesses)
create function private.best_partner(p_program_id uuid, p_need text) returns uuid
language sql stable security definer set search_path = '' as $$
  select m.user_id from public.program_members m
  where m.program_id = p_program_id and m.role = 'partner'
    and (p_need = any (m.capabilities) or cardinality(m.capabilities) = 0)
  order by (case when p_need = any (m.capabilities) then 1 else 0.5 end)
         / (1 + coalesce((private.program_partner_metrics(m.program_id, m.user_id, 180) ->> 'verify_turnaround_hours')::numeric / 24, 0))
         / (1 + 0.1 * (select count(*) from public.partner_assignments a where a.partner_user_id = m.user_id)) desc,
         m.user_id
  limit 1;
$$;

create function public.route_candidates(p_program_id uuid, p_need text default 'verification') returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_program_member(p_program_id, array['admin']::public.program_role[]) and not private.is_platform_admin() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('user_id', m.user_id, 'capable', p_need = any (m.capabilities),
      'load', (select count(*) from public.partner_assignments a where a.partner_user_id = m.user_id),
      'verify_turnaround_hours', private.program_partner_metrics(m.program_id, m.user_id, 180) -> 'verify_turnaround_hours',
      'chosen', m.user_id = private.best_partner(p_program_id, p_need))), '[]')
    from public.program_members m where m.program_id = p_program_id and m.role = 'partner');
end $$;

-- B23 routine ops with B36 routing (only change: partner selection).
create or replace function public.run_routine_ops(p_business_id uuid default null) returns jsonb
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
      -- Unusual: N (policy, default 3) requests in three weeks without a record → a person follows up.
      if (select count(*) from public.agent_actions where business_id = b.id and action_type = 'ops.record_request' and created_at > now() - interval '21 days' and created_at > last_rec) >= private.escalation_threshold(b.id) then
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
        partner := private.best_partner(r.program_id, 'verification');   -- B36: capability + history + load
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

revoke execute on function public.set_partner_capabilities(uuid, uuid, text[]), public.partner_performance(int, uuid), public.route_candidates(uuid, text) from public, anon;
grant execute on function public.set_partner_capabilities(uuid, uuid, text[]), public.partner_performance(int, uuid), public.route_candidates(uuid, text) to authenticated;
