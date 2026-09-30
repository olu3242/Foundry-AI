-- B18 Network learning: lineage, recommendation feedback/outcome tracking, extraction accuracy,
-- Pulse calibration, evaluation snapshots and drift. Association only — never causal claims.
-- Reuses B9 agent_actions/agent_runs, B5 record_drafts, B11 pulse_feedback/outcomes, B13 funnel.

alter table public.agent_runs add column prompt_version text;
alter table public.agent_actions
  add column generator text not null default 'rules-v1',
  add column solution_version_id uuid references public.solution_versions (id),
  add column rank_score numeric,
  add column rank_basis jsonb;

-- Keep what the AI proposed so confirmation edits become a quality signal.
alter table public.record_drafts add column ai_fields jsonb;
create function private.keep_ai_fields() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.ai_fields := coalesce(new.ai_fields, new.fields);
  return new;
end $$;
create trigger record_drafts_ai_fields before insert on public.record_drafts for each row execute function private.keep_ai_fields();

-- One row per recommendation with what happened next.
create view private.recommendation_facts as
  select a.id, a.business_id, a.generator, a.solution_version_id, a.created_at, a.status,
    i.id intervention_id, i.status istatus, o.improved, o.status ostatus,
    case
      when i.id is not null or a.status in ('approved', 'executed') then 'accepted'
      when a.status = 'rejected' then 'rejected'
      when a.status = 'proposed' and a.created_at > now() - interval '14 days' then 'pending'
      else 'ignored'
    end decision,
    extract(epoch from (coalesce(a.decided_at, i.started_at) - a.created_at)) / 3600 decision_hours
  from public.agent_actions a
  left join public.interventions i on i.source_action_id = a.id
  left join public.outcomes o on o.intervention_id = i.id
  where a.action_type = 'growth.recommend';

create function public.recommendation_eval(p_days int default 90) returns table (
  generator text, shown int, accepted int, rejected int, ignored int, pending int,
  acceptance_rate numeric, completion_rate numeric, improved_rate numeric, verified_rate numeric, median_decision_hours numeric
)
language sql stable security definer set search_path = '' as $$
  select generator, count(*)::int,
    count(*) filter (where decision = 'accepted')::int, count(*) filter (where decision = 'rejected')::int,
    count(*) filter (where decision = 'ignored')::int, count(*) filter (where decision = 'pending')::int,
    round(count(*) filter (where decision = 'accepted')::numeric / nullif(count(*) filter (where decision <> 'pending'), 0), 3),
    round(count(*) filter (where istatus = 'completed')::numeric / nullif(count(*) filter (where decision = 'accepted'), 0), 3),
    round(count(*) filter (where improved)::numeric / nullif(count(*) filter (where istatus = 'completed'), 0), 3),
    round(count(*) filter (where improved and ostatus = 'verified')::numeric / nullif(count(*) filter (where istatus = 'completed'), 0), 3),
    round((percentile_cont(0.5) within group (order by decision_hours))::numeric, 1)
  from private.recommendation_facts where created_at > now() - make_interval(days => p_days)
  group by generator order by generator;
$$;

create function public.extraction_eval(p_days int default 90) returns table (
  model text, drafts int, confirmed int, confirmed_unedited int, edited int, rejected int, edit_rate numeric, reject_rate numeric
)
language sql stable security definer set search_path = '' as $$
  select coalesce(r.model, 'unknown'), count(*)::int,
    count(*) filter (where d.status = 'confirmed')::int,
    count(*) filter (where d.status = 'confirmed' and d.fields = d.ai_fields)::int,
    count(*) filter (where d.status = 'confirmed' and d.fields <> d.ai_fields)::int,
    count(*) filter (where d.status = 'rejected')::int,
    round(count(*) filter (where d.status = 'confirmed' and d.fields <> d.ai_fields)::numeric / nullif(count(*) filter (where d.status = 'confirmed'), 0), 3),
    round(count(*) filter (where d.status = 'rejected')::numeric / nullif(count(*) filter (where d.status <> 'proposed'), 0), 3)
  from public.record_drafts d left join public.agent_runs r on r.id = d.agent_run_id
  where d.created_at > now() - make_interval(days => p_days)
  group by 1 order by 1;
$$;

create function public.pulse_calibration(p_days int default 90) returns table (dimension text, feedback int, accurate int, accuracy numeric)
language sql stable security definer set search_path = '' as $$
  select dimension, count(*)::int, count(*) filter (where verdict = 'accurate')::int,
    round(count(*) filter (where verdict = 'accurate')::numeric / nullif(count(*) filter (where verdict <> 'unclear'), 0), 3)
  from public.pulse_feedback where created_at > now() - make_interval(days => p_days)
  group by dimension order by dimension;
$$;

-- Per-solution evidence for ranking (verified improvements over completed plans), all businesses.
create function public.solution_rank_stats() returns table (solution_version_id uuid, target_dimension text, completed int, verified_improved int)
language sql stable security definer set search_path = '' as $$
  select v.id, s.target_dimension,
    count(*) filter (where i.status = 'completed')::int,
    count(*) filter (where o.improved and o.status = 'verified')::int
  from public.solution_versions v join public.solutions s on s.id = v.solution_id
  left join public.interventions i on i.solution_version_id = v.id
  left join public.outcomes o on o.intervention_id = i.id
  where s.status = 'active' and v.status = 'active'
  group by v.id, s.target_dimension;
$$;

create table public.eval_snapshots (
  id        uuid primary key default gen_random_uuid(),
  taken_on  date not null default current_date,
  scope     text not null check (scope in ('recommendations', 'extraction', 'pulse_calibration')),
  subject   text not null,
  metrics   jsonb not null,
  drift     boolean not null default false,
  unique (taken_on, scope, subject)
);

-- Daily snapshot; drift = a rate moving more than 15 points since the previous snapshot.
create function public.take_eval_snapshot() returns int
language plpgsql security definer set search_path = '' as $$
declare
  n int;
begin
  insert into public.eval_snapshots (scope, subject, metrics)
  select 'recommendations', generator, to_jsonb(r) - 'generator' from public.recommendation_eval(30) r
  union all select 'extraction', model, to_jsonb(e) - 'model' from public.extraction_eval(30) e
  union all select 'pulse_calibration', dimension, to_jsonb(c) - 'dimension' from public.pulse_calibration(30) c
  on conflict (taken_on, scope, subject) do update set metrics = excluded.metrics;
  get diagnostics n = row_count;
  update public.eval_snapshots cur set drift = exists (
    select 1 from public.eval_snapshots prev, jsonb_each(cur.metrics) m
    where prev.scope = cur.scope and prev.subject = cur.subject and prev.taken_on < cur.taken_on
      and prev.taken_on = (select max(taken_on) from public.eval_snapshots p2 where p2.scope = cur.scope and p2.subject = cur.subject and p2.taken_on < cur.taken_on)
      and m.key in ('acceptance_rate', 'verified_rate', 'edit_rate', 'reject_rate', 'accuracy')
      and jsonb_typeof(m.value) = 'number' and jsonb_typeof(prev.metrics -> m.key) = 'number'
      and abs((m.value)::text::numeric - (prev.metrics ->> m.key)::numeric) > 0.15
  )
  where cur.taken_on = current_date;
  return n;
end $$;

revoke execute on function public.recommendation_eval(int), public.extraction_eval(int), public.pulse_calibration(int),
  public.take_eval_snapshot() from public, anon, authenticated;
grant execute on function public.recommendation_eval(int), public.extraction_eval(int), public.pulse_calibration(int),
  public.solution_rank_stats(), public.take_eval_snapshot() to service_role;
revoke execute on function public.solution_rank_stats() from public, anon, authenticated;

-- Platform-admin wrappers for the learning dashboard.
create function public.learning_overview() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_platform_admin() then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'recommendations', (select coalesce(jsonb_agg(to_jsonb(r)), '[]') from public.recommendation_eval(90) r),
    'extraction', (select coalesce(jsonb_agg(to_jsonb(e)), '[]') from public.extraction_eval(90) e),
    'pulse_calibration', (select coalesce(jsonb_agg(to_jsonb(c)), '[]') from public.pulse_calibration(90) c),
    'drift', (select coalesce(jsonb_agg(jsonb_build_object('scope', scope, 'subject', subject, 'on', taken_on)), '[]')
              from public.eval_snapshots where drift and taken_on > current_date - 30)
  );
end $$;
grant execute on function public.learning_overview() to authenticated;

alter table public.eval_snapshots enable row level security;
create policy "eval: platform admins" on public.eval_snapshots for select to authenticated using (private.is_platform_admin());
revoke insert, update, delete on public.eval_snapshots from authenticated;
