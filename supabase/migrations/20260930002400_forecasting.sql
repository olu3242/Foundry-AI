-- B26 Forecasting: sales outlook, cash pressure, inventory demand, collections, intervention
-- scenarios. Every forecast stores its inputs, method version, assumptions, uncertainty and
-- confidence, and is reproducible from those inputs alone (pure functions). Sparse data yields
-- "insufficient" with a request for more data — never fabricated precision. Weeks without records
-- are unknown and excluded (they lower confidence), not treated as zero.
-- Reuses B5 books, B7 cadence, B13 solution evidence, B25 no-trading periods + quality.

create table public.forecasts (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.businesses (id) on delete cascade,
  kind          text not null check (kind in ('sales_outlook', 'cash_pressure', 'inventory_demand', 'collections', 'intervention_scenario')),
  subject_id    uuid,                -- product or solution version for per-subject forecasts
  as_of         timestamptz not null default now(),
  horizon_days  int not null,
  method        text not null,
  method_version text not null default 'fc-v1',
  inputs        jsonb not null,      -- exactly what the method consumed
  input_digest  text not null,
  assumptions   jsonb not null,
  result        jsonb,               -- null when insufficient
  confidence    text not null check (confidence in ('high', 'medium', 'low', 'insufficient')),
  basis         text not null,
  request       text                 -- what would make this forecast possible or better
);
create index forecasts_business_idx on public.forecasts (business_id, kind, as_of desc);

-- ─── Pure methods (inputs → result) ───────────────────────────────────────────
create function private.fc_stats(xs numeric[]) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare
  n int := coalesce(array_length(xs, 1), 0);
  m numeric;
  sd numeric;
  slope numeric;
begin
  if n = 0 then
    return jsonb_build_object('n', 0);
  end if;
  select avg(x), coalesce(stddev_samp(x), 0) into m, sd from unnest(xs) x;
  -- Least-squares slope per step (x = 1..n, oldest first).
  select coalesce(regr_slope(x::float8, i::float8), 0)::numeric into slope from unnest(xs) with ordinality t(x, i);
  return jsonb_build_object('n', n, 'mean', round(m, 2), 'sd', round(sd, 2), 'cv', case when m = 0 then null else round(sd / m, 3) end, 'slope', round(slope, 2));
end $$;

create function private.fc_confidence(n int, cv numeric, completeness numeric, min_n int, good_n int) returns text
language sql immutable set search_path = '' as $$
  select case
    when n < min_n then 'insufficient'
    when n >= good_n and coalesce(cv, 9) < 0.35 and completeness >= 0.85 then 'high'
    when coalesce(cv, 9) < 0.7 and completeness >= 0.6 then 'medium'
    else 'low' end;
$$;

-- Weekly series → total over the next h weeks with an 80% interval. Trend is damped by half and
-- the point never goes below zero.
create function private.fc_weekly_outlook(inputs jsonb, horizon_weeks int) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare
  xs numeric[] := array(select (jsonb_array_elements_text(inputs -> 'weekly')::numeric));
  s jsonb := private.fc_stats(xs);
  n int := (s ->> 'n')::int;
  point numeric;
  half numeric;
begin
  if n = 0 then
    return null;
  end if;
  -- Damped trend from the centre of the history to the centre of the horizon: (n + h) / 2 steps.
  point := greatest(0, ((s ->> 'mean')::numeric + 0.5 * (s ->> 'slope')::numeric * (n + horizon_weeks) / 2.0) * horizon_weeks);
  half := 1.2816 * (s ->> 'sd')::numeric * sqrt(horizon_weeks) * (1 + 1.0 / greatest(n, 1));
  return jsonb_build_object('point', round(point), 'low', round(greatest(0, point - half)), 'high', round(point + half), 'stats', s);
end $$;

create function private.fc_compute(kind text, inputs jsonb, horizon_days int) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare
  hw int := greatest(1, round(horizon_days / 7.0)::int);
  o jsonb;
  inflow numeric;
  outflow numeric;
  rate numeric;
  d numeric;
begin
  if kind = 'sales_outlook' then
    return private.fc_weekly_outlook(inputs, hw);
  elsif kind = 'cash_pressure' then
    o := private.fc_weekly_outlook(jsonb_build_object('weekly', inputs -> 'weekly_collected'), hw);
    inflow := coalesce((o ->> 'point')::numeric, 0) + coalesce((inputs ->> 'expected_collections')::numeric, 0);
    outflow := coalesce((private.fc_weekly_outlook(jsonb_build_object('weekly', inputs -> 'weekly_expenses'), hw) ->> 'point')::numeric, 0);
    return jsonb_build_object('expected_in', round(inflow), 'expected_out', round(outflow), 'net', round(inflow - outflow),
      'in_low', round(coalesce((o ->> 'low')::numeric, 0) + coalesce((inputs ->> 'expected_collections')::numeric, 0)),
      'warning', (coalesce((o ->> 'low')::numeric, 0) + coalesce((inputs ->> 'expected_collections')::numeric, 0)) < outflow);
  elsif kind = 'inventory_demand' then
    o := private.fc_weekly_outlook(jsonb_build_object('weekly', inputs -> 'weekly_units'), hw);
    d := coalesce((o -> 'stats' ->> 'mean')::numeric, 0) / 7.0;
    return o || jsonb_build_object('stock_qty', inputs -> 'stock_qty',
      'days_of_stock', case when d > 0 then round((inputs ->> 'stock_qty')::numeric / d, 1) end,
      'runs_out_within_horizon', d > 0 and (inputs ->> 'stock_qty')::numeric / d < horizon_days);
  elsif kind = 'collections' then
    rate := (inputs ->> 'settled')::numeric / nullif((inputs ->> 'credit_sales')::numeric, 0);
    return jsonb_build_object('open_minor', inputs -> 'open_minor', 'historical_rate', round(rate, 3),
      'expected_minor', round((inputs ->> 'open_minor')::numeric * rate),
      -- Wilson 80% interval on the rate.
      'low_minor', round((inputs ->> 'open_minor')::numeric * greatest(0, (rate + 0.8212 / (2 * (inputs ->> 'credit_sales')::numeric)
          - 1.2816 * sqrt(rate * (1 - rate) / (inputs ->> 'credit_sales')::numeric + 1.6424 / (4 * (inputs ->> 'credit_sales')::numeric ^ 2)))
          / (1 + 1.6424 / (inputs ->> 'credit_sales')::numeric))),
      'high_minor', round((inputs ->> 'open_minor')::numeric * least(1, (rate + 0.8212 / (2 * (inputs ->> 'credit_sales')::numeric)
          + 1.2816 * sqrt(rate * (1 - rate) / (inputs ->> 'credit_sales')::numeric + 1.6424 / (4 * (inputs ->> 'credit_sales')::numeric ^ 2)))
          / (1 + 1.6424 / (inputs ->> 'credit_sales')::numeric))));
  elsif kind = 'intervention_scenario' then
    rate := (inputs ->> 'improved')::numeric / nullif((inputs ->> 'completed')::numeric, 0);
    return jsonb_build_object('improvement_rate', round(rate, 3), 'completed', inputs -> 'completed', 'improved', inputs -> 'improved',
      'median_delta', inputs -> 'median_delta', 'baseline_outlook', inputs -> 'baseline_point',
      'scenario_point', case when inputs ->> 'baseline_point' is not null and inputs ->> 'median_delta' is not null
        then round((inputs ->> 'baseline_point')::numeric + rate * (inputs ->> 'median_delta')::numeric) end);
  end if;
  return null;
end $$;

-- The weaker of two confidence levels.
create function private.least_conf(a text, b text) returns text
language sql immutable set search_path = '' as $$
  select (array['insufficient', 'low', 'medium', 'high'])[least(array_position(array['insufficient', 'low', 'medium', 'high'], a),
                                                                array_position(array['insufficient', 'low', 'medium', 'high'], b))];
$$;

-- ─── Input gathering + storage ────────────────────────────────────────────────
create function private.fc_store(bid uuid, k text, subj uuid, horizon int, meth text, inputs jsonb, assumptions jsonb, conf text, basis text, req text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  fid uuid;
begin
  insert into public.forecasts (business_id, kind, subject_id, horizon_days, method, inputs, input_digest, assumptions, result, confidence, basis, request)
  values (bid, k, subj, horizon, meth, inputs, encode(extensions.digest(inputs::text, 'sha256'), 'hex'), assumptions,
          case when conf = 'insufficient' then null else private.fc_compute(k, inputs, horizon) end, conf, basis, req)
  returning id into fid;
  return fid;
end $$;

create function public.compute_forecasts(p_business_id uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare
  cur text;
  wk0 date := date_trunc('week', now())::date;   -- current (partial) week excluded
  weeks int := 12;
  sales_w numeric[];
  coll_w numeric[];
  exp_w numeric[];
  completeness numeric;
  s jsonb;
  conf text;
  n int := 0;
  r record;
  units numeric[];
  open_minor bigint;
  credit_n int;
  settled_n int;
  base jsonb;
begin
  if not (private.can_read(p_business_id) or coalesce(auth.role(), '') = 'service_role') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select currency into cur from public.businesses where id = p_business_id;

  -- Weekly totals for weeks that have records (unknown weeks excluded).
  with w as (select (wk0 - 7 * g)::date ws from generate_series(1, weeks) g),
  per as (
    select w.ws,
      (select sum(total_minor) from public.sales s where s.business_id = p_business_id and s.voided_at is null and s.occurred_at >= w.ws and s.occurred_at < w.ws + 7) sales,
      (select sum(amount_paid_minor) from public.sales s where s.business_id = p_business_id and s.voided_at is null and s.occurred_at >= w.ws and s.occurred_at < w.ws + 7) coll,
      (select sum(amount_minor) from public.expenses e where e.business_id = p_business_id and e.voided_at is null and e.occurred_at >= w.ws and e.occurred_at < w.ws + 7) exp
    from w
  )
  select array_agg(coalesce(sales, 0) order by ws) filter (where sales is not null or exp is not null),
         array_agg(coalesce(coll, 0) order by ws) filter (where sales is not null or exp is not null),
         array_agg(coalesce(exp, 0) order by ws) filter (where sales is not null or exp is not null),
         round(count(*) filter (where sales is not null or exp is not null)::numeric / weeks, 3)
    into sales_w, coll_w, exp_w, completeness
  from per;
  sales_w := coalesce(sales_w, '{}'); coll_w := coalesce(coll_w, '{}'); exp_w := coalesce(exp_w, '{}');

  -- 1. Sales outlook, next 4 weeks.
  s := private.fc_stats(sales_w);
  conf := private.fc_confidence((s ->> 'n')::int, (s ->> 'cv')::numeric, completeness, 6, 10);
  perform private.fc_store(p_business_id, 'sales_outlook', null, 28, 'weekly_mean_damped_trend',
    jsonb_build_object('weekly', to_jsonb(sales_w), 'weeks_window', weeks, 'completeness', completeness, 'currency', cur),
    jsonb_build_array('Recent weeks are a guide to the next four', 'Weeks without any records are unknown and left out, not counted as zero',
                      'Trend is damped by half', 'Interval is 80%: one in five outcomes falls outside it'),
    conf, 'Sales in ' || coalesce(array_length(sales_w, 1), 0) || ' of the last ' || weeks || ' weeks with records',
    case when conf = 'insufficient' then 'Record sales for ' || (6 - coalesce(array_length(sales_w, 1), 0)) || ' more week(s) to see an outlook'
         when conf = 'low' then 'Recording every week makes this more reliable' end);
  n := n + 1;

  -- 2. Cash pressure, next 2 weeks: money in (collected + expected collections) vs money out.
  select coalesce(sum(total_minor - amount_paid_minor), 0) into open_minor from public.sales
  where business_id = p_business_id and voided_at is null and total_minor > amount_paid_minor and occurred_at > now() - interval '60 days';
  select count(*), count(*) filter (where amount_paid_minor >= total_minor) into credit_n, settled_n from public.sales
  where business_id = p_business_id and voided_at is null and payment_method = 'credit' and occurred_at < now() - interval '30 days';
  conf := private.least_conf(private.fc_confidence(coalesce(array_length(coll_w, 1), 0), (private.fc_stats(coll_w) ->> 'cv')::numeric, completeness, 4, 10),
                     private.fc_confidence(coalesce(array_length(exp_w, 1), 0), (private.fc_stats(exp_w) ->> 'cv')::numeric, completeness, 4, 10));
  perform private.fc_store(p_business_id, 'cash_pressure', null, 14, 'collected_vs_expenses',
    jsonb_build_object('weekly_collected', to_jsonb(coll_w), 'weekly_expenses', to_jsonb(exp_w), 'completeness', completeness, 'currency', cur,
      'expected_collections', case when credit_n >= 5 then round(open_minor * settled_n::numeric / credit_n * 0.5) else 0 end),
    jsonb_build_array('Cash on hand is not known; this compares expected money in with money out',
      'Warning uses the low end of expected money in', 'Collections count only when there is a history of 5+ credit sales'),
    conf, 'Collections and expenses in weeks with records',
    case when conf = 'insufficient' then 'Record sales and expenses for at least 4 weeks' end);
  n := n + 1;

  -- 3. Inventory demand per product sold in 4+ of the last 8 weeks.
  for r in
    select p.id, p.name, p.stock_qty from public.products p where p.business_id = p_business_id
      and (select count(distinct date_trunc('week', m.occurred_at)) from public.stock_movements m
           where m.product_id = p.id and m.reason = 'sale' and m.occurred_at >= wk0 - 56 and m.occurred_at < wk0) >= 2
  loop
    select array_agg(coalesce(u, 0) order by ws) filter (where u is not null) into units from (
      select (wk0 - 7 * g)::date ws, (select -sum(quantity_delta) from public.stock_movements m where m.product_id = r.id and m.reason = 'sale'
                 and m.occurred_at >= wk0 - 7 * g and m.occurred_at < wk0 - 7 * g + 7) u
      from generate_series(1, 8) g) x;
    units := coalesce(units, '{}');
    s := private.fc_stats(units);
    conf := private.fc_confidence((s ->> 'n')::int, (s ->> 'cv')::numeric, (s ->> 'n')::numeric / 8, 4, 7);
    perform private.fc_store(p_business_id, 'inventory_demand', r.id, 14, 'weekly_units_mean',
      jsonb_build_object('product', r.name, 'weekly_units', to_jsonb(units), 'stock_qty', r.stock_qty),
      jsonb_build_array('Units sold per week continue at the recent rate', 'Stock on hand is as recorded'),
      conf, r.name || ': units sold in ' || coalesce(array_length(units, 1), 0) || ' of the last 8 weeks',
      case when conf = 'insufficient' then 'Record ' || r.name || ' sales for 4+ weeks' end);
    n := n + 1;
  end loop;

  -- 4. Collections, next 30 days, from this business's own settlement history.
  conf := case when credit_n < 5 then 'insufficient' when credit_n < 15 then 'low' when credit_n < 40 then 'medium' else 'high' end;
  if open_minor > 0 or credit_n > 0 then
    perform private.fc_store(p_business_id, 'collections', null, 30, 'historical_settlement_rate',
      jsonb_build_object('open_minor', open_minor, 'credit_sales', credit_n, 'settled', settled_n, 'currency', cur),
      jsonb_build_array('Customers pay at the rate past credit customers did', 'Only credit sales older than 30 days count as history'),
      conf, credit_n || ' past credit sale(s), ' || settled_n || ' fully paid',
      case when conf = 'insufficient' then 'Needs at least 5 past credit sales to estimate' end);
    n := n + 1;
  end if;

  -- 5. Intervention scenarios for proven plans (B13 evidence) on the sales outlook.
  base := (select result from public.forecasts where business_id = p_business_id and kind = 'sales_outlook' order by as_of desc limit 1);
  for r in
    select v.id vid, s2.name, count(*) filter (where i.status = 'completed') completed,
      count(*) filter (where o.improved and o.status = 'verified') improved,
      percentile_cont(0.5) within group (order by o.delta) filter (where o.status = 'verified') median_delta
    from public.solution_versions v join public.solutions s2 on s2.id = v.solution_id
    left join public.interventions i on i.solution_version_id = v.id
    left join public.outcomes o on o.intervention_id = i.id
    where s2.status = 'active' and v.status = 'active' and s2.target_metric = 'sales_30'
    group by v.id, s2.name
  loop
    conf := case when r.completed < 10 then 'insufficient' when r.completed < 30 then 'low' else 'medium' end;
    perform private.fc_store(p_business_id, 'intervention_scenario', r.vid, 30, 'solution_evidence_on_outlook',
      jsonb_build_object('solution', r.name, 'completed', r.completed, 'improved', r.improved, 'median_delta', r.median_delta,
        'baseline_point', case when base is not null then base -> 'point' end),
      jsonb_build_array('Businesses that completed this plan are a guide, not a promise', 'Association, not causation', 'Applied to your own sales outlook'),
      conf, r.name || ': ' || r.completed || ' completed, ' || r.improved || ' verified improvements',
      case when conf = 'insufficient' then 'Not enough completed plans across Foundry yet to estimate the effect' end);
    n := n + 1;
  end loop;
  return n;
end $$;

-- Reproducibility: recompute from the stored inputs and compare.
create function public.reproduce_forecast(p_forecast_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  f public.forecasts;
  again jsonb;
begin
  select * into f from public.forecasts where id = p_forecast_id;
  if not found or not (private.can_read(f.business_id) or private.is_platform_admin()) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  again := case when f.confidence = 'insufficient' then null else private.fc_compute(f.kind, f.inputs, f.horizon_days) end;
  return jsonb_build_object('matches', again is not distinct from f.result
      and encode(extensions.digest(f.inputs::text, 'sha256'), 'hex') = f.input_digest,
    'method_version', f.method_version, 'stored', f.result, 'recomputed', again);
end $$;

create function public.latest_forecasts(p_business_id uuid) returns setof public.forecasts
language sql stable security definer set search_path = '' as $$
  select distinct on (kind, subject_id) * from public.forecasts
  where business_id = p_business_id and private.can_read(p_business_id)
  order by kind, subject_id, as_of desc;
$$;

create function public.compute_all_forecasts() returns int
language plpgsql security definer set search_path = '' as $$
declare
  n int := 0;
  b record;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not private.is_platform_admin() then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
  for b in select distinct business_id from public.events where occurred_at > now() - interval '30 days'
             and type in ('sale.recorded', 'expense.recorded') loop
    n := n + public.compute_forecasts(b.business_id);
  end loop;
  return n;
end $$;

revoke execute on function public.compute_forecasts(uuid), public.reproduce_forecast(uuid), public.latest_forecasts(uuid),
  public.compute_all_forecasts() from public, anon;
grant execute on function public.compute_forecasts(uuid), public.reproduce_forecast(uuid), public.latest_forecasts(uuid),
  public.compute_all_forecasts() to authenticated;

alter table public.forecasts enable row level security;
create policy "forecasts: readers" on public.forecasts for select to authenticated using (private.can_read(business_id));
revoke insert, update, delete on public.forecasts from authenticated;
