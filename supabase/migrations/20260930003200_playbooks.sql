-- B34 Playbook engine: reusable multi-step plans for recurring problems, composed from existing
-- solutions (no duplicated solution logic). Each step is a normal B11 intervention, so metering
-- (B21), policy (B28), decisions (B33) and outcome measurement apply unchanged. Steps advance on
-- their gate; the playbook's own result is measured against its baseline.

create table public.playbooks (
  key          text primary key check (key ~ '^[a-z_]{3,60}$'),
  name         text not null,
  problem      text not null,               -- Pulse dimension this playbook addresses
  metric       text not null check (private.metric_direction(metric) is not null),
  steps        jsonb not null,              -- [{ "solution": "collect_overdue", "gate": "completed" | "improved" }]
  status       text not null default 'active' check (status in ('active', 'retired')),
  version      int not null default 1,
  constraint playbooks_steps check (jsonb_typeof(steps) = 'array' and jsonb_array_length(steps) between 2 and 6)
);

create table public.playbook_runs (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.businesses (id) on delete cascade,
  playbook_key  text not null references public.playbooks (key),
  version       int not null,
  trigger       jsonb not null default '{}',
  decision_id   uuid references public.decisions (id) on delete set null,
  status        text not null default 'running' check (status in ('running', 'completed', 'stopped', 'abandoned')),
  current_step  int not null default 1,
  baseline      numeric,
  result        jsonb,
  stop_reason   text,
  launched_by   uuid not null default auth.uid() references public.profiles (id),
  started_at    timestamptz not null default now(),
  ended_at      timestamptz
);
create unique index playbook_runs_one_running on public.playbook_runs (business_id, playbook_key) where status = 'running';
create index playbook_runs_business_idx on public.playbook_runs (business_id, started_at desc);
create trigger playbook_runs_audit after insert or update of status on public.playbook_runs for each row execute function private.audit_row();

create table public.playbook_run_steps (
  run_id           uuid not null references public.playbook_runs (id) on delete cascade,
  step_no          int not null,
  solution_key     text not null,
  gate             text not null check (gate in ('completed', 'improved')),
  intervention_id  uuid references public.interventions (id) on delete set null,
  status           text not null default 'pending' check (status in ('pending', 'active', 'passed', 'failed', 'skipped')),
  started_at       timestamptz,
  ended_at         timestamptz,
  primary key (run_id, step_no)
);
create index playbook_run_steps_intervention_idx on public.playbook_run_steps (intervention_id);

insert into public.playbooks (key, name, problem, metric, steps) values
  ('cash_crunch', 'Get through a cash crunch', 'cash_flow', 'collected_30',
   '[{"solution":"collect_overdue","gate":"completed"},{"solution":"cost_review","gate":"completed"}]'),
  ('sales_recovery', 'Recover falling sales', 'sales_momentum', 'sales_30',
   '[{"solution":"win_back_customers","gate":"completed"},{"solution":"grow_sales_push","gate":"completed"}]'),
  ('get_finance_ready', 'Get ready for finance', 'evidence_strength', 'records_verified_30',
   '[{"solution":"daily_record_habit","gate":"completed"},{"solution":"back_your_numbers","gate":"completed"}]');

-- Starts one step as a normal intervention on behalf of whoever launched the run.
create function private.start_playbook_step(r public.playbook_runs, step int) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  s public.playbook_run_steps;
  sol record;
  iid uuid;
begin
  select * into s from public.playbook_run_steps where run_id = r.id and step_no = step;
  select so.name, so.target_metric, so.default_window_days, v.id vid into sol
  from public.solutions so join lateral (select id from public.solution_versions where solution_id = so.id and status = 'active' order by version desc limit 1) v on true
  where so.key = s.solution_key and so.status = 'active';
  if sol.vid is null then
    raise exception 'Playbook step % uses a solution that is no longer offered', step using errcode = 'P0001';
  end if;
  insert into public.interventions (business_id, solution_version_id, title, target_metric, expected_direction, baseline_value, window_days, due_at, created_by, created_by_role)
  values (r.business_id, sol.vid, sol.name || ' (playbook step ' || step || ')', sol.target_metric, private.metric_direction(sol.target_metric),
          coalesce(private.metric_value(r.business_id, sol.target_metric), 0), sol.default_window_days, now() + make_interval(days => sol.default_window_days),
          r.launched_by, coalesce(public.my_business_role(r.business_id), 'owner'))
  returning id into iid;
  update public.playbook_run_steps set intervention_id = iid, status = 'active', started_at = now() where run_id = r.id and step_no = step;
  update public.playbook_runs set current_step = step where id = r.id;
  perform private.emit_event(r.business_id, 'intervention.started', 'intervention', iid, jsonb_build_object('title', sol.name, 'metric', sol.target_metric, 'playbook', r.playbook_key));
  return iid;
end $$;

create function public.launch_playbook(p_business_id uuid, p_playbook_key text, p_decision_id uuid default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  p public.playbooks;
  r public.playbook_runs;
begin
  if not private.has_role(p_business_id, array['owner', 'staff']::public.business_role[]) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select * into p from public.playbooks where key = p_playbook_key and status = 'active';
  if p.key is null then
    raise exception 'Unknown playbook' using errcode = 'P0002';
  end if;
  insert into public.playbook_runs (business_id, playbook_key, version, trigger, decision_id, baseline)
  values (p_business_id, p.key, p.version,
    coalesce((select jsonb_build_object('dimension', dimension, 'state', state, 'why', why) from public.pulse_snapshots
              where business_id = p_business_id and dimension = p.problem order by computed_on desc limit 1), '{}'),
    p_decision_id, private.metric_value(p_business_id, p.metric))
  returning * into r;
  insert into public.playbook_run_steps (run_id, step_no, solution_key, gate)
  select r.id, i, s ->> 'solution', coalesce(s ->> 'gate', 'completed') from jsonb_array_elements(p.steps) with ordinality t(s, i);
  perform private.start_playbook_step(r, 1);   -- policy/metering triggers apply; a denial aborts the launch
  perform private.emit_event(p_business_id, 'playbook.launched', 'playbook_run', r.id, jsonb_build_object('playbook', p.key));
  return r.id;
end $$;

-- Finishes a run and measures the playbook's own metric against its launch baseline.
create function private.finish_playbook(r public.playbook_runs, final_status text, reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  p public.playbooks;
  now_v numeric;
begin
  select * into p from public.playbooks where key = r.playbook_key;
  now_v := private.metric_value(r.business_id, p.metric);
  update public.playbook_runs set status = final_status, ended_at = now(), stop_reason = reason,
    result = jsonb_build_object('metric', p.metric, 'baseline', r.baseline, 'observed', now_v, 'delta', now_v - r.baseline,
      'improved', case when r.baseline is null or now_v is null then null
                       when private.metric_direction(p.metric) = 'up' then now_v > r.baseline else now_v < r.baseline end)
  where id = r.id;
  perform private.emit_event(r.business_id, 'playbook.' || final_status, 'playbook_run', r.id, jsonb_build_object('playbook', r.playbook_key));
end $$;

-- Gate evaluation when a step's plan completes / is abandoned or its result arrives.
create function private.advance_playbook(iid uuid, event text, improved boolean default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  s public.playbook_run_steps;
  r public.playbook_runs;
  last_step int;
begin
  select * into s from public.playbook_run_steps where intervention_id = iid and status = 'active';
  if s.run_id is null then
    return;
  end if;
  select * into r from public.playbook_runs where id = s.run_id and status = 'running';
  if r.id is null then
    return;
  end if;
  select max(step_no) into last_step from public.playbook_run_steps where run_id = r.id;
  if event = 'abandoned' then
    update public.playbook_run_steps set status = 'failed', ended_at = now() where run_id = r.id and step_no = s.step_no;
    perform private.finish_playbook(r, 'abandoned', 'Step ' || s.step_no || ' was abandoned');
    return;
  end if;
  if s.gate = 'improved' and event = 'completed' then
    return;                                         -- wait for the measured result
  end if;
  if s.gate = 'improved' and event = 'outcome' and not coalesce(improved, false) then
    update public.playbook_run_steps set status = 'failed', ended_at = now() where run_id = r.id and step_no = s.step_no;
    perform private.finish_playbook(r, 'stopped', 'Step ' || s.step_no || ' did not improve its metric');
    return;
  end if;
  if (s.gate = 'completed' and event = 'completed') or (s.gate = 'improved' and event = 'outcome') then
    update public.playbook_run_steps set status = 'passed', ended_at = now() where run_id = r.id and step_no = s.step_no;
    if s.step_no = last_step then
      perform private.finish_playbook(r, 'completed', null);
    else
      perform private.start_playbook_step(r, s.step_no + 1);
    end if;
  end if;
end $$;

create function private.playbook_on_intervention() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status in ('completed', 'abandoned') and old.status = 'active' then
    perform private.advance_playbook(new.id, new.status::text);
  end if;
  return new;
end $$;
create trigger interventions_playbook after update of status on public.interventions for each row execute function private.playbook_on_intervention();

create function private.playbook_on_outcome() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.advance_playbook(new.intervention_id, 'outcome', new.improved);
  return new;
end $$;
create trigger outcomes_playbook after insert on public.outcomes for each row execute function private.playbook_on_outcome();

-- Problems detected now (Pulse at risk / recurring) → matching playbooks not already running.
create function public.suggest_playbooks(p_business_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.can_read(p_business_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('key', p.key, 'name', p.name, 'problem', p.problem, 'why', s.why,
      'steps', (select jsonb_agg(so.name order by i) from jsonb_array_elements(p.steps) with ordinality t(st, i) join public.solutions so on so.key = st ->> 'solution'),
      'recurring', exists (select 1 from public.business_memory m where m.business_id = p_business_id and m.kind = 'recurring_issue' and m.topic = p.problem))), '[]')
    from public.playbooks p
    join lateral (select state, why from public.pulse_snapshots where business_id = p_business_id and dimension = p.problem order by computed_on desc limit 1) s on true
    where p.status = 'active' and s.state in ('at_risk', 'watch')
      and not exists (select 1 from public.playbook_runs r where r.business_id = p_business_id and r.playbook_key = p.key and r.status = 'running'));
end $$;

create function public.playbook_effectiveness() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_platform_admin() then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('playbook', playbook_key, 'runs', n, 'completed', c, 'stopped', st, 'abandoned', ab,
      'improved', imp, 'improved_rate', round(imp::numeric / nullif(c, 0), 3)) order by playbook_key), '[]')
    from (select playbook_key, count(*) n, count(*) filter (where status = 'completed') c, count(*) filter (where status = 'stopped') st,
            count(*) filter (where status = 'abandoned') ab, count(*) filter (where status = 'completed' and (result ->> 'improved')::boolean) imp
          from public.playbook_runs group by playbook_key) x);
end $$;

revoke execute on function public.launch_playbook(uuid, text, uuid), public.suggest_playbooks(uuid), public.playbook_effectiveness() from public, anon;
grant execute on function public.launch_playbook(uuid, text, uuid), public.suggest_playbooks(uuid), public.playbook_effectiveness() to authenticated;

alter table public.playbooks enable row level security;
alter table public.playbook_runs enable row level security;
alter table public.playbook_run_steps enable row level security;
create policy "playbooks: readable" on public.playbooks for select to authenticated using (true);
create policy "runs: readers" on public.playbook_runs for select to authenticated using (private.can_read(business_id) or private.is_platform_admin());
create policy "run steps: readers" on public.playbook_run_steps for select to authenticated
  using (exists (select 1 from public.playbook_runs r where r.id = run_id and (private.can_read(r.business_id) or private.is_platform_admin())));
revoke insert, update, delete on public.playbooks, public.playbook_runs, public.playbook_run_steps from authenticated;
