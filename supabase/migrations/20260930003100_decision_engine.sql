-- B33 Decision engine: one canonical, replayable decision object
--   SIGNAL → OPTIONS → EVIDENCE → RISK → EXPECTED VALUE → AUTHORITY → DECISION → RESULT
-- built from rules + evidence (B13/B18), memory (B32), policy (B28) and autonomy (B9/B23); people
-- accept, override or reject; results link back when outcomes arrive. Choice is a pure function of
-- the stored options, so every decision can be re-derived.

create table public.decisions (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references public.businesses (id) on delete cascade,
  topic            text not null,
  signal           jsonb not null,
  options          jsonb not null,
  evidence         jsonb not null,
  authority        jsonb not null,
  recommended      text,
  chosen           text,
  decided_by       text check (decided_by in ('rules', 'ai', 'human', 'policy')),
  decided_by_user  uuid references public.profiles (id),
  status           text not null default 'proposed' check (status in ('proposed', 'accepted', 'overridden', 'rejected', 'expired')),
  result           jsonb,
  agent_action_id  uuid references public.agent_actions (id) on delete set null,
  intervention_id  uuid references public.interventions (id) on delete set null,
  method_version   text not null default 'decide-v1',
  inputs_digest    text not null,
  created_at       timestamptz not null default now(),
  decided_at       timestamptz
);
create index decisions_business_idx on public.decisions (business_id, created_at desc);
create index decisions_action_idx on public.decisions (agent_action_id) where agent_action_id is not null;
create index decisions_intervention_idx on public.decisions (intervention_id) where intervention_id is not null;
create trigger decisions_audit after insert or update of status on public.decisions for each row execute function private.audit_row();

-- Pure choice: highest score among options policy allows (ties → shorter plan). Do-nothing is an option.
create function private.decision_choose(options jsonb) returns text
language sql immutable set search_path = '' as $$
  select o ->> 'key' from jsonb_array_elements(options) o
  where coalesce(o -> 'risk' ->> 'policy', 'allow') <> 'deny'
  order by (o ->> 'score')::numeric desc, coalesce((o ->> 'window_days')::int, 0) limit 1;
$$;

-- The worker (service role) builds decisions too, so it may read data quality.
create or replace function public.data_quality_score(p_business_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  first_at timestamptz;
  last_at timestamptz;
  from_wk date;
  weeks_total int;
  weeks_ok int;
  n90 int;
  open_bad int;
  strong int;
  verified int;
  dims jsonb;
begin
  if not (private.can_read(p_business_id) or coalesce(auth.role(), '') = 'service_role') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select min(occurred_at), max(occurred_at) into first_at, last_at from (
    select occurred_at from public.sales where business_id = p_business_id and voided_at is null
    union all select occurred_at from public.expenses where business_id = p_business_id and voided_at is null) x;
  if last_at is null then
    return jsonb_build_object('overall', null, 'records', 0, 'dimensions', jsonb_build_object(
      'completeness', null, 'consistency', null, 'recency', null, 'provenance', null, 'verification', null),
      'note', 'No records yet: quality is unknown, not zero.');
  end if;
  from_wk := greatest(date_trunc('week', first_at), date_trunc('week', now() - interval '12 weeks'))::date;
  select count(*), count(*) filter (where exists (
      select 1 from public.sales s where s.business_id = p_business_id and s.voided_at is null and s.occurred_at >= g and s.occurred_at < g + interval '1 week'
      union all select 1 from public.expenses e where e.business_id = p_business_id and e.voided_at is null and e.occurred_at >= g and e.occurred_at < g + interval '1 week'
      union all select 1 from public.no_trading_periods n where n.business_id = p_business_id and n.period_start <= (g + interval '6 days')::date and n.period_end >= g::date))
    into weeks_total, weeks_ok
  from generate_series(from_wk::timestamptz, date_trunc('week', now()), interval '1 week') g;
  select count(*), count(*) filter (where provenance <> 'self_reported') into n90, strong from (
    select provenance from public.sales where business_id = p_business_id and voided_at is null and occurred_at > now() - interval '90 days'
    union all select provenance from public.expenses where business_id = p_business_id and voided_at is null and occurred_at > now() - interval '90 days') x;
  select count(*) into open_bad from public.data_quality_issues where business_id = p_business_id and status = 'open' and kind in ('duplicate', 'conflict');
  select count(*) into verified from public.sales s where s.business_id = p_business_id and s.voided_at is null and s.occurred_at > now() - interval '90 days'
    and (s.provenance in ('third_party_verified', 'institution_verified') or exists (
      select 1 from public.attestations a join public.verification_requests r on r.id = a.request_id
      where a.business_id = p_business_id and a.status = 'active' and a.result = 'confirmed' and r.scope -> 'sale_ids' ? s.id::text));
  dims := jsonb_build_object(
    'completeness', jsonb_build_object('score', round(weeks_ok::numeric / nullif(weeks_total, 0), 3), 'weeks_covered', weeks_ok, 'weeks', weeks_total),
    'consistency', jsonb_build_object('score', case when n90 = 0 then null else round(greatest(0, 1 - open_bad::numeric / n90), 3) end, 'open_issues', open_bad, 'records_90d', n90),
    'recency', jsonb_build_object('score', case when last_at > now() - interval '2 days' then 1 when last_at > now() - interval '7 days' then 0.75
                                               when last_at > now() - interval '14 days' then 0.5 when last_at > now() - interval '30 days' then 0.25 else 0 end,
                                  'last_record_at', last_at),
    'provenance', jsonb_build_object('score', case when n90 = 0 then null else round(strong::numeric / n90, 3) end, 'backed', strong, 'records_90d', n90),
    'verification', jsonb_build_object('score', case when n90 = 0 then null else round(verified::numeric / n90, 3) end, 'verified_sales', verified, 'records_90d', n90));
  return jsonb_build_object('records', n90, 'dimensions', dims,
    'overall', (select round(avg((v ->> 'score')::numeric), 3) from jsonb_each(dims) d(k, v) where v ->> 'score' is not null),
    'open_issues', (select count(*) from public.data_quality_issues where business_id = p_business_id and status = 'open'));
end $$;

create function public.create_decision(p_business_id uuid, p_topic text, p_agent_action_id uuid default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  sig jsonb;
  ctx jsonb;
  opts jsonb;
  ev jsonb;
  auth_ jsonb;
  quality jsonb;
  did uuid;
begin
  if not (private.can_write(p_business_id) or coalesce(auth.role(), '') = 'service_role') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  -- SIGNAL: the latest Pulse reading for the topic.
  select jsonb_build_object('dimension', dimension, 'state', state, 'score', score, 'why', why, 'computed_on', computed_on) into sig
  from public.pulse_snapshots where business_id = p_business_id and dimension = p_topic order by computed_on desc limit 1;
  sig := coalesce(sig, jsonb_build_object('dimension', p_topic, 'state', 'unknown'));
  ctx := public.memory_context(p_business_id, p_topic);
  quality := public.data_quality_score(p_business_id);

  -- OPTIONS with EXPECTED VALUE (Beta(1,1) posterior on verified improvement across Foundry) and RISK.
  select coalesce(jsonb_agg(o), '[]') into opts from (
    select jsonb_build_object(
      'key', s.key, 'kind', 'solution', 'title', s.name, 'solution_version_id', v.id, 'window_days', s.default_window_days, 'metric', s.target_metric,
      'expected_value', jsonb_build_object('p_improve', round((coalesce(st.verified_improved, 0) + 1)::numeric / (coalesce(st.completed, 0) + 2), 3),
          'completed', coalesce(st.completed, 0), 'verified_improved', coalesce(st.verified_improved, 0)),
      'risk', jsonb_build_object('policy', private.evaluate_policy('solution.start', private.solution_policy_ctx(p_business_id, v.id), p_business_id, false) ->> 'result',
          'tried_before_without_improvement', exists (select 1 from jsonb_array_elements(ctx -> 'prior_plans') pp
              where pp ->> 'solution_version_id' = v.id::text and (pp -> 'result' ->> 'improved')::boolean is false),
          'effort_days', s.default_window_days),
      'score', round(((coalesce(st.verified_improved, 0) + 1)::numeric / (coalesce(st.completed, 0) + 2))
                 * case when exists (select 1 from jsonb_array_elements(ctx -> 'prior_plans') pp
                                     where pp ->> 'solution_version_id' = v.id::text and (pp -> 'result' ->> 'improved')::boolean is false) then 0.5 else 1 end, 3)) o
    from public.solutions s
    join lateral (select * from public.solution_versions v2 where v2.solution_id = s.id and v2.status = 'active' order by v2.version desc limit 1) v on true
    left join public.solution_rank_stats() st on st.solution_version_id = v.id
    where s.status = 'active' and s.target_dimension = p_topic and s.provider_id is null
      and (s.vertical_pack is null or exists (select 1 from public.business_packs bp where bp.business_id = p_business_id and bp.pack_key = s.vertical_pack))
    union all
    select jsonb_build_object('key', 'do_nothing', 'kind', 'do_nothing', 'title', 'Keep going as you are',
      'expected_value', jsonb_build_object('p_improve', null), 'risk', jsonb_build_object('policy', 'allow'),
      -- Doing nothing wins only when the signal is healthy or nothing has any evidence.
      'score', case when sig ->> 'state' in ('strong', 'steady', 'insufficient_data', 'unknown') then 0.6 else 0.2 end)
  ) x;

  ev := jsonb_build_object('memory', ctx, 'data_quality', jsonb_build_object('overall', quality -> 'overall', 'records_90d', quality -> 'records'),
    'note', 'Expected values come from verified results across Foundry; association, not proof of cause.');
  auth_ := jsonb_build_object('level', private.ops_level(p_business_id, 'growth.recommend', 1, 1), 'mode', 'suggest',
    'rule', 'Foundry recommends; a person decides');
  insert into public.decisions (business_id, topic, signal, options, evidence, authority, recommended, decided_by, agent_action_id, inputs_digest)
  values (p_business_id, p_topic, sig, opts, ev, auth_, private.decision_choose(opts), 'rules', p_agent_action_id,
          encode(extensions.digest(opts::text, 'sha256'), 'hex'))
  returning id into did;
  return did;
end $$;

-- People decide: starting a plan from the suggestion accepts (or overrides) it.
create function private.decision_on_intervention() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  d public.decisions;
  v_chosen text;
begin
  select * into d from public.decisions where agent_action_id = new.source_action_id and status = 'proposed' order by created_at desc limit 1;
  if d.id is null then
    select * into d from public.decisions where business_id = new.business_id and status = 'proposed'
      and topic = private.metric_topic(new.target_metric) and created_at > now() - interval '14 days' order by created_at desc limit 1;
  end if;
  if d.id is null then
    return new;
  end if;
  v_chosen := coalesce((select o ->> 'key' from jsonb_array_elements(d.options) o where o ->> 'solution_version_id' = new.solution_version_id::text), 'custom');
  update public.decisions set chosen = v_chosen, decided_by = 'human', decided_by_user = auth.uid(), decided_at = now(), intervention_id = new.id,
    status = case when v_chosen = d.recommended then 'accepted' else 'overridden' end
  where id = d.id;
  return new;
end $$;
create trigger interventions_decision after insert on public.interventions for each row execute function private.decision_on_intervention();

create function private.decision_on_action() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'rejected' and old.status <> 'rejected' then
    update public.decisions set status = 'rejected', chosen = 'do_nothing', decided_by = 'human', decided_by_user = auth.uid(), decided_at = now()
    where agent_action_id = new.id and status = 'proposed';
  end if;
  return new;
end $$;
create trigger agent_actions_decision after update of status on public.agent_actions for each row execute function private.decision_on_action();

-- RESULT: outcomes flow back to the decision that led to them.
create function private.decision_on_outcome() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.decisions set result = jsonb_build_object('outcome_id', new.id, 'improved', new.improved, 'delta', new.delta, 'status', new.status, 'at', now())
  where intervention_id = new.intervention_id;
  return new;
end $$;
create trigger outcomes_decision after insert or update of status, improved on public.outcomes for each row execute function private.decision_on_outcome();

create function public.explain_decision(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  d public.decisions;
begin
  select * into d from public.decisions where id = p_id;
  if not found or not (private.can_read(d.business_id) or private.is_platform_admin()) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return to_jsonb(d) || jsonb_build_object(
    'replay', jsonb_build_object('recommended_again', private.decision_choose(d.options),
      'matches', private.decision_choose(d.options) is not distinct from d.recommended
                 and encode(extensions.digest(d.options::text, 'sha256'), 'hex') = d.inputs_digest));
end $$;

create function public.decision_quality(p_days int default 180) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_platform_admin() then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
  return (select jsonb_build_object(
    'decisions', count(*),
    'accepted', count(*) filter (where status = 'accepted'), 'overridden', count(*) filter (where status = 'overridden'),
    'rejected', count(*) filter (where status = 'rejected'),
    'improved_when_accepted', round(count(*) filter (where status = 'accepted' and (result ->> 'improved')::boolean)::numeric
                                    / nullif(count(*) filter (where status = 'accepted' and result is not null), 0), 3),
    'improved_when_overridden', round(count(*) filter (where status = 'overridden' and (result ->> 'improved')::boolean)::numeric
                                      / nullif(count(*) filter (where status = 'overridden' and result is not null), 0), 3))
  from public.decisions where created_at > now() - make_interval(days => p_days));
end $$;

revoke execute on function public.create_decision(uuid, text, uuid), public.explain_decision(uuid), public.decision_quality(int) from public, anon;
grant execute on function public.create_decision(uuid, text, uuid), public.explain_decision(uuid), public.decision_quality(int) to authenticated, service_role;

alter table public.decisions enable row level security;
create policy "decisions: readers" on public.decisions for select to authenticated using (private.can_read(business_id) or private.is_platform_admin());
revoke insert, update, delete on public.decisions from authenticated;
