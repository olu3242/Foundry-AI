-- B14 Benchmarking: comparable-business cohorts with sample thresholds, quality weighting and
-- explicit confidence. Currency-free ratio metrics so cohorts span currencies within a country.
-- Reuses B7 pulse_metrics (inputs) and B5/B8 provenance (quality).

create table public.benchmarks (
  cohort_key       text not null,
  level            text not null check (level in ('country_sector_band', 'country_sector', 'country')),
  country_code     text not null,
  sector           text,
  band             text,
  metric           text not null check (metric in ('margin', 'collection_rate', 'active_days_30', 'repeat_share', 'receivable_ratio')),
  period_end       date not null,
  n                int not null,
  p25              numeric,
  p50              numeric,
  p75              numeric,
  weighted_median  numeric,
  avg_quality      numeric not null,
  confidence       text not null check (confidence in ('none', 'low', 'medium', 'high')),
  computed_at      timestamptz not null default now(),
  primary key (cohort_key, metric, period_end)
);
create index benchmarks_lookup_idx on public.benchmarks (country_code, metric, period_end desc);

-- Per-business inputs from the latest computation (service-only; never exposed row by row).
create table private.benchmark_inputs (
  business_id  uuid primary key,
  country_code text not null,
  sector       text,
  band         text not null,
  quality      numeric not null,
  values       jsonb not null,
  computed_at  timestamptz not null default now()
);

create function private.benchmark_min_n() returns int language sql immutable as $$ select 10 $$;

create function private.confidence_for(p_n int, p_quality numeric) returns text
language sql immutable as $$
  select case
    when p_n < private.benchmark_min_n() then 'none'
    when p_n >= 100 then case when p_quality < 0.5 then 'medium' else 'high' end
    when p_n >= 30 then case when p_quality < 0.5 then 'low' else 'medium' end
    else 'low'
  end;
$$;

create function public.compute_benchmarks() returns int
language plpgsql security definer set search_path = '' as $$
declare
  today date := current_date;
  cohorts int;
begin
  delete from private.benchmark_inputs where true; -- PostgREST sessions enforce safeupdate
  insert into private.benchmark_inputs (business_id, country_code, sector, band, quality, values)
  select b.id, b.country_code, b.sector,
    case when (m ->> 'records_30')::int < 20 then 'starter' when (m ->> 'records_30')::int <= 80 then 'active' else 'busy' end,
    -- Quality: share of backed records and recording consistency, floored so self-reported data still counts a little.
    round(0.3 + 0.7 * ((coalesce((m ->> 'records_verified_30')::numeric / nullif((m ->> 'records_30')::numeric, 0), 0)
                        + least((m ->> 'active_days_30')::numeric / 30, 1)) / 2), 3),
    jsonb_strip_nulls(jsonb_build_object(
      'margin', case when (m ->> 'sales_30')::numeric > 0 then ((m ->> 'sales_30')::numeric - (m ->> 'expenses_30')::numeric) / (m ->> 'sales_30')::numeric end,
      'collection_rate', case when (m ->> 'sales_30')::numeric > 0 then (m ->> 'collected_30')::numeric / (m ->> 'sales_30')::numeric end,
      'active_days_30', (m ->> 'active_days_30')::numeric,
      'repeat_share', case when (m ->> 'customers_60')::numeric >= 3 then (m ->> 'repeat_customers_60')::numeric / (m ->> 'customers_60')::numeric end,
      'receivable_ratio', case when (m ->> 'sales_30')::numeric > 0 then (m ->> 'receivable_total')::numeric / (m ->> 'sales_30')::numeric end
    ))
  from public.businesses b, lateral (select public.pulse_metrics(b.id) m) x
  where b.archived_at is null and (m ->> 'records_30')::int >= 5;

  delete from public.benchmarks where period_end = today;
  with inputs as (
    select i.*, kv.key metric, kv.value::numeric val from private.benchmark_inputs i, jsonb_each_text(i.values) kv
  ),
  levels as (
    select 'country_sector_band' level, country_code, sector, band, metric, val, quality from inputs where sector is not null
    union all select 'country_sector', country_code, sector, null, metric, val, quality from inputs where sector is not null
    union all select 'country', country_code, null, null, metric, val, quality from inputs
  ),
  agg as (
    select level, country_code, sector, band, metric, count(*)::int n, round(avg(quality), 3) q,
      percentile_cont(0.25) within group (order by val) p25, percentile_cont(0.5) within group (order by val) p50,
      percentile_cont(0.75) within group (order by val) p75,
      -- Quality-weighted median: the value where cumulative weight crosses half.
      jsonb_agg(jsonb_build_object('v', val, 'w', quality) order by val) pairs
    from levels group by level, country_code, sector, band, metric
  )
  insert into public.benchmarks (cohort_key, level, country_code, sector, band, metric, period_end, n, p25, p50, p75, weighted_median, avg_quality, confidence)
  select concat_ws('|', level, country_code, sector, band), level, country_code, sector, band, metric, today, n,
    case when n >= private.benchmark_min_n() then round(p25::numeric, 4) end,
    case when n >= private.benchmark_min_n() then round(p50::numeric, 4) end,
    case when n >= private.benchmark_min_n() then round(p75::numeric, 4) end,
    case when n >= private.benchmark_min_n() then (
      select round((e ->> 'v')::numeric, 4) from (
        select e, sum((e ->> 'w')::numeric) over (order by ord) cum, sum((e ->> 'w')::numeric) over () total
        from jsonb_array_elements(pairs) with ordinality t(e, ord)
      ) w where cum >= total / 2 order by cum limit 1) end,
    q, private.confidence_for(n, q)
  from agg;
  get diagnostics cohorts = row_count;
  return cohorts;
end $$;
revoke execute on function public.compute_benchmarks() from public, anon, authenticated;
grant execute on function public.compute_benchmarks() to service_role;

-- A business's own values against the most specific cohort that has enough data.
-- Percentiles only at 'low' confidence or better; a position only at 'medium' or better. No ranks.
create function public.business_benchmark(p_business_id uuid) returns table (
  metric text, value numeric, cohort text, level text, n int, period_end date, avg_quality numeric,
  confidence text, p25 numeric, p50 numeric, p75 numeric, placement text
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
declare
  i private.benchmark_inputs;
begin
  if not private.can_read(p_business_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select * into i from private.benchmark_inputs where business_id = p_business_id;
  if not found then
    return;
  end if;
  return query
  select m.key, m.value::numeric, concat_ws(' · ', bm.country_code, bm.sector, bm.band), bm.level, bm.n, bm.period_end, bm.avg_quality,
    bm.confidence, bm.p25, bm.p50, bm.p75,
    case when bm.confidence in ('medium', 'high') then
      case when m.value::numeric < bm.p25 then 'lower than most' when m.value::numeric > bm.p75 then 'higher than most' else 'around the middle' end
    end
  from jsonb_each_text(i.values) m
  cross join lateral (
    select b.* from public.benchmarks b
    where b.metric = m.key and b.country_code = i.country_code
      and ((b.level = 'country_sector_band' and b.sector = i.sector and b.band = i.band)
        or (b.level = 'country_sector' and b.sector = i.sector)
        or b.level = 'country')
      and b.period_end = (select max(period_end) from public.benchmarks)
    order by (b.confidence <> 'none') desc,
      case b.level when 'country_sector_band' then 1 when 'country_sector' then 2 else 3 end
    limit 1
  ) bm;
end $$;
revoke execute on function public.business_benchmark(uuid) from public, anon;
grant execute on function public.business_benchmark(uuid) to authenticated;

alter table public.benchmarks enable row level security;
create policy "benchmarks: aggregate, confident only" on public.benchmarks for select to authenticated using (confidence <> 'none');
revoke insert, update, delete on public.benchmarks from authenticated;
