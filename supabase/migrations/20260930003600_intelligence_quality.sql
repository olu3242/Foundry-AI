-- B38 Intelligence quality: one objective scorecard for Pulse, extraction, recommendations,
-- forecasts and decision support — accuracy/precision, false positives, calibration (interval
-- coverage), acceptance, completion, outcomes and drift — so improvement or degradation is
-- detected from data, not opinion. Reuses B18 evaluations + snapshots, B26 forecasts, B33 decisions.

create table public.forecast_evaluations (
  forecast_id     uuid primary key references public.forecasts (id) on delete cascade,
  business_id     uuid not null references public.businesses (id) on delete cascade,
  kind            text not null,
  horizon_end     timestamptz not null,
  actual          numeric,               -- null when the business kept no records in the window (unknown)
  point           numeric,
  low             numeric,
  high            numeric,
  in_interval     boolean,
  abs_pct_error   numeric,
  evaluated_at    timestamptz not null default now()
);
create index forecast_evaluations_business_idx on public.forecast_evaluations (business_id);

-- Backtest sales outlooks whose horizon has passed against what was actually recorded.
create function public.evaluate_forecasts() returns int
language plpgsql security definer set search_path = '' as $$
declare
  n int;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not private.is_platform_admin() then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
  insert into public.forecast_evaluations (forecast_id, business_id, kind, horizon_end, actual, point, low, high, in_interval, abs_pct_error)
  select f.id, f.business_id, f.kind, f.as_of + make_interval(days => f.horizon_days), a.actual,
    (f.result ->> 'point')::numeric, (f.result ->> 'low')::numeric, (f.result ->> 'high')::numeric,
    case when a.actual is null then null else a.actual between (f.result ->> 'low')::numeric and (f.result ->> 'high')::numeric end,
    case when a.actual is null or a.actual = 0 then null else round(abs((f.result ->> 'point')::numeric - a.actual) / a.actual, 4) end
  from public.forecasts f
  join lateral (select case when count(*) = 0 then null else sum(total_minor) end actual from public.sales s
                where s.business_id = f.business_id and s.voided_at is null
                  and s.occurred_at >= date_trunc('week', f.as_of) and s.occurred_at < date_trunc('week', f.as_of) + make_interval(days => f.horizon_days)) a on true
  where f.kind = 'sales_outlook' and f.result is not null and f.as_of + make_interval(days => f.horizon_days) < now()
    and not exists (select 1 from public.forecast_evaluations e where e.forecast_id = f.id);
  get diagnostics n = row_count;
  return n;
end $$;

alter table public.eval_snapshots drop constraint eval_snapshots_scope_check;
alter table public.eval_snapshots add constraint eval_snapshots_scope_check
  check (scope in ('recommendations', 'extraction', 'pulse_calibration', 'forecasts', 'decisions', 'pulse_precision'));

create function private.intelligence_metrics(p_days int) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'pulse', jsonb_build_object(
      'calibration', (select coalesce(jsonb_agg(to_jsonb(c)), '[]') from public.pulse_calibration(p_days) c),
      -- Precision of at-risk signals: owner feedback on at-risk dimensions that was "accurate".
      'at_risk_precision', (select round(count(*) filter (where f.verdict = 'accurate')::numeric / nullif(count(*) filter (where f.verdict <> 'unclear'), 0), 3)
        from public.pulse_feedback f join public.pulse_snapshots s on s.business_id = f.business_id and s.dimension = f.dimension and s.computed_on = f.computed_on
        where s.state = 'at_risk' and f.created_at > now() - make_interval(days => p_days)),
      'false_positive_rate', (select round(count(*) filter (where f.verdict = 'inaccurate')::numeric / nullif(count(*) filter (where f.verdict <> 'unclear'), 0), 3)
        from public.pulse_feedback f join public.pulse_snapshots s on s.business_id = f.business_id and s.dimension = f.dimension and s.computed_on = f.computed_on
        where s.state = 'at_risk' and f.created_at > now() - make_interval(days => p_days)),
      'feedback', (select count(*) from public.pulse_feedback where created_at > now() - make_interval(days => p_days))),
    'extraction', (select coalesce(jsonb_agg(to_jsonb(e)), '[]') from public.extraction_eval(p_days) e),
    'recommendations', (select coalesce(jsonb_agg(to_jsonb(r)), '[]') from public.recommendation_eval(p_days) r),
    'forecasts', (select jsonb_build_object('evaluated', count(*), 'unknown_actuals', count(*) filter (where actual is null),
        'interval_coverage', round(count(*) filter (where in_interval)::numeric / nullif(count(*) filter (where actual is not null), 0), 3),
        'target_coverage', 0.8,
        'mape', round(avg(abs_pct_error), 3))
      from public.forecast_evaluations where evaluated_at > now() - make_interval(days => p_days)),
    'decisions', (select jsonb_build_object('decisions', count(*),
        'acceptance_rate', round(count(*) filter (where status = 'accepted')::numeric / nullif(count(*) filter (where status <> 'proposed'), 0), 3),
        'override_rate', round(count(*) filter (where status = 'overridden')::numeric / nullif(count(*) filter (where status <> 'proposed'), 0), 3),
        'improved_when_accepted', round(count(*) filter (where status = 'accepted' and (result ->> 'improved')::boolean)::numeric
                                       / nullif(count(*) filter (where status = 'accepted' and result is not null), 0), 3),
        'improved_when_overridden', round(count(*) filter (where status = 'overridden' and (result ->> 'improved')::boolean)::numeric
                                         / nullif(count(*) filter (where status = 'overridden' and result is not null), 0), 3))
      from public.decisions where created_at > now() - make_interval(days => p_days)));
$$;

-- Daily snapshot of the new scopes with drift (> 15 points on a rate since the previous snapshot).
create function public.take_intelligence_snapshot() returns int
language plpgsql security definer set search_path = '' as $$
declare
  m jsonb;
  n int;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not private.is_platform_admin() then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
  perform public.evaluate_forecasts();
  m := private.intelligence_metrics(30);
  insert into public.eval_snapshots (scope, subject, metrics) values
    ('forecasts', 'sales_outlook', m -> 'forecasts'), ('decisions', 'decide-v1', m -> 'decisions'),
    ('pulse_precision', 'at_risk', jsonb_build_object('at_risk_precision', m -> 'pulse' -> 'at_risk_precision', 'false_positive_rate', m -> 'pulse' -> 'false_positive_rate'))
  on conflict (taken_on, scope, subject) do update set metrics = excluded.metrics;
  get diagnostics n = row_count;
  update public.eval_snapshots cur set drift = exists (
    select 1 from public.eval_snapshots prev, jsonb_each(cur.metrics) k
    where prev.scope = cur.scope and prev.subject = cur.subject
      and prev.taken_on = (select max(taken_on) from public.eval_snapshots p2 where p2.scope = cur.scope and p2.subject = cur.subject and p2.taken_on < cur.taken_on)
      and k.key in ('interval_coverage', 'mape', 'acceptance_rate', 'improved_when_accepted', 'at_risk_precision', 'false_positive_rate')
      and jsonb_typeof(k.value) = 'number' and jsonb_typeof(prev.metrics -> k.key) = 'number'
      and abs((k.value)::text::numeric - (prev.metrics ->> k.key)::numeric) > 0.15)
  where cur.taken_on = current_date and cur.scope in ('forecasts', 'decisions', 'pulse_precision');
  return n;
end $$;

-- Scorecard: each capability's current numbers, previous snapshot and direction of travel.
create function public.intelligence_quality(p_days int default 90) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  m jsonb;
begin
  if not private.is_platform_admin() then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
  m := private.intelligence_metrics(p_days);
  return m || jsonb_build_object(
    'trend', (select coalesce(jsonb_object_agg(scope || ':' || subject, jsonb_build_object('latest', latest, 'previous', previous, 'drift', drift)), '{}') from (
      select distinct on (scope, subject) scope, subject, metrics latest, drift,
        (select metrics from public.eval_snapshots p where p.scope = s.scope and p.subject = s.subject and p.taken_on < s.taken_on order by taken_on desc limit 1) previous
      from public.eval_snapshots s order by scope, subject, taken_on desc) x),
    'drift_alerts', (select coalesce(jsonb_agg(jsonb_build_object('scope', scope, 'subject', subject, 'on', taken_on)), '[]')
                     from public.eval_snapshots where drift and taken_on > current_date - 30),
    'note', 'Rates need samples: compare numbers with their counts before acting.');
end $$;

revoke execute on function public.evaluate_forecasts(), public.take_intelligence_snapshot(), public.intelligence_quality(int) from public, anon;
grant execute on function public.evaluate_forecasts(), public.take_intelligence_snapshot(), public.intelligence_quality(int) to authenticated, service_role;

alter table public.forecast_evaluations enable row level security;
create policy "forecast evaluations: readers" on public.forecast_evaluations for select to authenticated
  using (private.can_read(business_id) or private.is_platform_admin());
revoke insert, update, delete on public.forecast_evaluations from authenticated;
