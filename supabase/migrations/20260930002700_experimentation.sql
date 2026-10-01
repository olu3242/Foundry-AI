-- B29 Experimentation: randomized, sticky assignment of businesses to solution variants,
-- intention-to-treat analysis with confidence intervals, guardrails, termination criteria and a
-- result history. High-impact financial/legal decisions can never be experimented on.
-- Reuses B13 solutions/versions + funnel, B11 interventions/outcomes, B18 evaluation, B28 rule matcher.

create table public.experiments (
  id                  uuid primary key default gen_random_uuid(),
  key                 text not null unique check (key ~ '^[a-z0-9_]{3,60}$'),
  name                text not null,
  hypothesis          text not null check (char_length(hypothesis) between 10 and 1000),
  surface             text not null,
  solution_id         uuid references public.solutions (id),
  arms                jsonb not null,          -- [{ "key": "control", "weight": 50, "solution_version_id": "…" }, …]
  eligibility         jsonb,                   -- optional B28-style condition on business context
  primary_metric      text not null default 'improved_rate' check (primary_metric in ('improved_rate', 'completion_rate')),
  guardrails          jsonb not null default '[{"metric":"abandon_rate","max":0.5}]',
  min_per_arm         int not null default 30 check (min_per_arm >= 5),
  max_duration_days   int not null default 90 check (max_duration_days between 7 and 365),
  status              text not null default 'draft' check (status in ('draft', 'running', 'stopped', 'concluded')),
  conclusion          text,
  created_by          uuid default auth.uid() references public.profiles (id),
  created_at          timestamptz not null default now(),
  started_at          timestamptz,
  ended_at            timestamptz,
  -- Protected: finance, eligibility, pricing, consent and legal decisions are never experiments.
  constraint experiments_surface_allowed check (surface in ('solution_variant')),
  constraint experiments_arms check (jsonb_typeof(arms) = 'array' and jsonb_array_length(arms) between 2 and 4)
);
create unique index experiments_one_running_per_solution on public.experiments (solution_id) where status = 'running';
create trigger experiments_audit after insert or update on public.experiments for each row execute function private.audit_row();

create table public.experiment_assignments (
  experiment_id  uuid not null references public.experiments (id) on delete cascade,
  business_id    uuid not null references public.businesses (id) on delete cascade,
  arm            text not null,
  assigned_at    timestamptz not null default now(),
  primary key (experiment_id, business_id)
);
create index experiment_assignments_business_idx on public.experiment_assignments (business_id);

create table public.experiment_snapshots (
  id             bigint generated always as identity primary key,
  experiment_id  uuid not null references public.experiments (id) on delete cascade,
  taken_at       timestamptz not null default now(),
  results        jsonb not null,
  decision       text not null
);
create index experiment_snapshots_idx on public.experiment_snapshots (experiment_id, taken_at desc);

-- Deterministic, sticky arm choice from a stable hash of (experiment, business).
create function private.experiment_arm(e public.experiments, bid uuid) returns text
language sql immutable set search_path = '' as $$
  with a as (select x ->> 'key' k, (x ->> 'weight')::int w, i from jsonb_array_elements(e.arms) with ordinality t(x, i)),
  c as (select k, sum(w) over (order by i) cum, sum(w) over () total from a)
  select k from c where (abs(hashtext(e.id::text || ':' || bid::text)) % (select max(total) from c)) < cum order by cum limit 1;
$$;

-- The solution version a business should see: its arm's version while an experiment runs.
create function public.solution_version_for(p_business_id uuid, p_solution_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  e public.experiments;
  arm text;
begin
  if not private.can_read(p_business_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select * into e from public.experiments where solution_id = p_solution_id and status = 'running';
  if e.id is null or (e.eligibility is not null and not private.policy_match(e.eligibility, private.policy_context(p_business_id))) then
    return null;
  end if;
  select a.arm into arm from public.experiment_assignments a where a.experiment_id = e.id and a.business_id = p_business_id;
  if arm is null then
    arm := private.experiment_arm(e, p_business_id);
    insert into public.experiment_assignments (experiment_id, business_id, arm) values (e.id, p_business_id, arm) on conflict do nothing;
  end if;
  return (select (x ->> 'solution_version_id')::uuid from jsonb_array_elements(e.arms) x where x ->> 'key' = arm);
end $$;

-- ─── Analysis (intention-to-treat: arm by assignment) ─────────────────────────
create function private.experiment_results(e public.experiments) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  per jsonb;
  c record;
  t record;
  diff numeric;
  se numeric;
  z numeric;
  p numeric;
  decision text;
  breached jsonb;
begin
  with plans as (
    select a.arm, i.status, o.improved
    from public.experiment_assignments a
    join public.interventions i on i.business_id = a.business_id and i.started_at >= e.started_at
    join public.solution_versions v on v.id = i.solution_version_id and v.solution_id = e.solution_id
    left join public.outcomes o on o.intervention_id = i.id
    where a.experiment_id = e.id
  ),
  arms as (select x ->> 'key' arm from jsonb_array_elements(e.arms) x)
  select jsonb_object_agg(arms.arm, jsonb_build_object(
      'assigned', (select count(*) from public.experiment_assignments where experiment_id = e.id and arm = arms.arm),
      'started', (select count(*) from plans where plans.arm = arms.arm),
      'completed', (select count(*) from plans where plans.arm = arms.arm and status = 'completed'),
      'abandoned', (select count(*) from plans where plans.arm = arms.arm and status = 'abandoned'),
      'improved', (select count(*) from plans where plans.arm = arms.arm and improved)))
    into per from arms;

  -- Rates per arm.
  select jsonb_object_agg(k, v || jsonb_build_object(
      'completion_rate', round((v ->> 'completed')::numeric / nullif((v ->> 'started')::numeric, 0), 3),
      'improved_rate', round((v ->> 'improved')::numeric / nullif((v ->> 'completed')::numeric, 0), 3),
      'abandon_rate', round((v ->> 'abandoned')::numeric / nullif((v ->> 'started')::numeric, 0), 3)))
    into per from jsonb_each(per) x(k, v);

  -- Treatment (second arm) vs control (first arm) on the primary metric.
  select (per -> (e.arms -> 0 ->> 'key')) j into c;
  select (per -> (e.arms -> 1 ->> 'key')) j into t;
  declare
    num text := case e.primary_metric when 'improved_rate' then 'improved' else 'completed' end;
    den text := case e.primary_metric when 'improved_rate' then 'completed' else 'started' end;
    nc numeric := (c.j ->> den)::numeric; nt numeric := (t.j ->> den)::numeric;
    pc numeric := (c.j ->> num)::numeric / nullif(nc, 0); pt numeric := (t.j ->> num)::numeric / nullif(nt, 0);
    pool numeric;
  begin
    if nc > 0 and nt > 0 then
      diff := pt - pc;
      se := sqrt(pc * (1 - pc) / nc + pt * (1 - pt) / nt);
      pool := ((c.j ->> num)::numeric + (t.j ->> num)::numeric) / (nc + nt);
      z := case when pool in (0, 1) then 0 else diff / sqrt(pool * (1 - pool) * (1 / nc + 1 / nt)) end;
      -- Two-sided p-value via the normal CDF (Abramowitz–Stegun erf approximation).
      p := 2 * (1 - (0.5 * (1 + sign(abs(z) / sqrt(2)) * sqrt(1 - exp(-power(abs(z) / sqrt(2), 2) * (4 / pi() + 0.147 * power(abs(z) / sqrt(2), 2))
                                                        / (1 + 0.147 * power(abs(z) / sqrt(2), 2)))))));
    end if;
    breached := (select coalesce(jsonb_agg(g), '[]') from jsonb_array_elements(e.guardrails) g
                 where ((per -> (e.arms -> 1 ->> 'key')) ->> (g ->> 'metric'))::numeric > (g ->> 'max')::numeric);
    decision := case
      when jsonb_array_length(breached) > 0 then 'guardrail_breached'
      when coalesce(nc, 0) < e.min_per_arm or coalesce(nt, 0) < e.min_per_arm then 'insufficient_sample'
      when diff - 1.96 * se > 0 then 'treatment_better'
      when diff + 1.96 * se < 0 then 'treatment_worse'
      else 'no_detectable_difference' end;
  end;
  return jsonb_build_object('arms', per, 'primary_metric', e.primary_metric,
    'difference', round(diff, 3), 'ci95', case when se is null then null else jsonb_build_array(round(diff - 1.96 * se, 3), round(diff + 1.96 * se, 3)) end,
    'p_value', round(p, 4), 'guardrails_breached', breached, 'decision', decision,
    'note', 'Randomized assignment, intention-to-treat. Differences are measured, with uncertainty; small samples decide nothing.');
end $$;

-- Daily evaluation: snapshot results, then apply termination criteria.
create function public.evaluate_experiments() returns int
language plpgsql security definer set search_path = '' as $$
declare
  e public.experiments;
  r jsonb;
  n int := 0;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not private.is_platform_admin() then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
  for e in select * from public.experiments where status = 'running' loop
    r := private.experiment_results(e);
    insert into public.experiment_snapshots (experiment_id, results, decision) values (e.id, r, r ->> 'decision');
    if r ->> 'decision' = 'guardrail_breached' then
      update public.experiments set status = 'stopped', ended_at = now(), conclusion = 'Stopped automatically: guardrail breached ' || (r ->> 'guardrails_breached') where id = e.id;
    elsif r ->> 'decision' in ('treatment_better', 'treatment_worse') then
      update public.experiments set status = 'concluded', ended_at = now(), conclusion = r ->> 'decision' || ' (difference ' || (r ->> 'difference') || ', 95% CI ' || (r ->> 'ci95') || ')' where id = e.id;
    elsif e.started_at < now() - make_interval(days => e.max_duration_days) then
      update public.experiments set status = 'concluded', ended_at = now(), conclusion = 'Reached maximum duration: ' || (r ->> 'decision') where id = e.id;
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;

-- ─── Administration ───────────────────────────────────────────────────────────
create function public.create_experiment(p_key text, p_name text, p_hypothesis text, p_surface text, p_solution_id uuid, p_arms jsonb,
  p_primary_metric text default 'improved_rate', p_min_per_arm int default 30, p_max_duration_days int default 90,
  p_guardrails jsonb default '[{"metric":"abandon_rate","max":0.5}]', p_eligibility jsonb default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  eid uuid;
begin
  if not private.is_platform_admin() then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
  if p_surface ~ '^(finance|eligibility|pricing|consent|legal|evidence)' then
    raise exception 'Financial and legal decisions cannot be experimented on' using errcode = 'P0001';
  end if;
  if exists (select 1 from jsonb_array_elements(p_arms) a where not exists (
      select 1 from public.solution_versions v where v.id = (a ->> 'solution_version_id')::uuid and v.solution_id = p_solution_id and v.status = 'active')) then
    raise exception 'Every arm must use an active version of the solution' using errcode = 'P0001';
  end if;
  if (select sum((a ->> 'weight')::int) from jsonb_array_elements(p_arms) a) <> 100 then
    raise exception 'Arm weights must add up to 100' using errcode = '22023';
  end if;
  insert into public.experiments (key, name, hypothesis, surface, solution_id, arms, primary_metric, min_per_arm, max_duration_days, guardrails, eligibility)
  values (p_key, p_name, p_hypothesis, p_surface, p_solution_id, p_arms, p_primary_metric, p_min_per_arm, p_max_duration_days, p_guardrails, p_eligibility)
  returning id into eid;
  return eid;
end $$;

create function public.set_experiment_status(p_id uuid, p_status text, p_reason text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_platform_admin() then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
  if p_status = 'running' then
    update public.experiments set status = 'running', started_at = now() where id = p_id and status = 'draft';
  elsif p_status = 'stopped' then
    update public.experiments set status = 'stopped', ended_at = now(), conclusion = coalesce(p_reason, 'Stopped by an admin') where id = p_id and status = 'running';
  else
    raise exception 'Use running or stopped' using errcode = '22023';
  end if;
end $$;

create function public.experiment_report(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  e public.experiments;
begin
  if not private.is_platform_admin() then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
  select * into e from public.experiments where id = p_id;
  return jsonb_build_object('experiment', to_jsonb(e), 'current', case when e.started_at is not null then private.experiment_results(e) end,
    'history', (select coalesce(jsonb_agg(jsonb_build_object('at', taken_at, 'decision', decision, 'difference', results -> 'difference', 'ci95', results -> 'ci95') order by taken_at desc), '[]')
                from public.experiment_snapshots where experiment_id = p_id));
end $$;

revoke execute on function public.solution_version_for(uuid, uuid), public.evaluate_experiments(),
  public.create_experiment(text, text, text, text, uuid, jsonb, text, int, int, jsonb, jsonb), public.set_experiment_status(uuid, text, text),
  public.experiment_report(uuid) from public, anon;
grant execute on function public.solution_version_for(uuid, uuid), public.evaluate_experiments(),
  public.create_experiment(text, text, text, text, uuid, jsonb, text, int, int, jsonb, jsonb), public.set_experiment_status(uuid, text, text),
  public.experiment_report(uuid) to authenticated;

alter table public.experiments enable row level security;
alter table public.experiment_assignments enable row level security;
alter table public.experiment_snapshots enable row level security;
create policy "experiments: admins" on public.experiments for select to authenticated using (private.is_platform_admin());
create policy "assignments: admins or business" on public.experiment_assignments for select to authenticated
  using (private.is_platform_admin() or private.can_read(business_id));
create policy "snapshots: admins" on public.experiment_snapshots for select to authenticated using (private.is_platform_admin());
revoke insert, update, delete on public.experiments, public.experiment_assignments, public.experiment_snapshots from authenticated;

-- All running experiments' versions for one business in one call (assigns on first view).
create function public.experiment_versions_for(p_business_id uuid) returns table (solution_id uuid, solution_version_id uuid)
language sql security definer set search_path = '' as $$
  select e.solution_id, public.solution_version_for(p_business_id, e.solution_id)
  from public.experiments e where e.status = 'running' and private.can_read(p_business_id);
$$;
revoke execute on function public.experiment_versions_for(uuid) from public, anon;
grant execute on function public.experiment_versions_for(uuid) to authenticated;
