-- B20 Scale + funding readiness: one canonical evidence layer over B1–B19 (no new product logic).
-- Product, operations, solutions, economics, impact (VEI), distribution and data-moat metrics,
-- cohort retention, integrity and security certification. Platform admins only.

-- ─── Inputs that don't exist elsewhere ────────────────────────────────────────
create table public.fx_rates (
  currency      text primary key check (currency ~ '^[A-Z]{3}$'),
  usd_per_unit  numeric not null check (usd_per_unit > 0),
  minor_units   smallint not null default 2 check (minor_units between 0 and 3),
  as_of         date not null default current_date,
  source        text not null default 'seed: indicative, replace with a live feed'
);
insert into public.fx_rates (currency, usd_per_unit, minor_units) values
  ('USD', 1, 2), ('NGN', 0.00065, 2), ('GHS', 0.065, 2), ('KES', 0.0077, 2), ('ZAR', 0.055, 2),
  ('RWF', 0.00071, 0), ('XOF', 0.0017, 0), ('UGX', 0.00027, 0);

create table public.ai_prices (
  model              text primary key,
  usd_per_mtok_in    numeric not null,
  usd_per_mtok_out   numeric not null
);
insert into public.ai_prices values ('claude-opus-5-5', 4, 20), ('claude-sonnet-5-5', 2, 10), ('claude-haiku-4-5', 1, 5),
  ('heuristic-dev', 0, 0), ('rules-v1', 0, 0), ('rules-v2-ranked', 0, 0);

create table public.cost_inputs (
  id          uuid primary key default gen_random_uuid(),
  month       date not null check (extract(day from month) = 1),
  category    text not null check (category in ('infrastructure', 'operator', 'other')),
  amount_usd  numeric not null check (amount_usd >= 0),
  note        text,
  created_at  timestamptz not null default now()
);

create table public.revenue_events (
  id            uuid primary key default gen_random_uuid(),
  source        text not null default 'stripe',
  external_id   text unique,
  program_id    uuid references public.programs (id) on delete set null,
  amount_minor  bigint not null,
  currency      text not null,
  occurred_at   timestamptz not null default now()
);

create table public.metrics_daily (
  day    date not null,
  key    text not null,
  value  numeric,
  primary key (day, key)
);

create function private.to_usd(p_minor numeric, p_currency text) returns numeric
language sql stable security definer set search_path = '' as $$
  select round(p_minor / power(10::numeric, f.minor_units) * f.usd_per_unit, 2) from public.fx_rates f where f.currency = p_currency;
$$;

-- ─── Canonical metrics ────────────────────────────────────────────────────────
create function public.scale_metrics(p_from timestamptz default now() - interval '30 days', p_to timestamptz default now()) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  months numeric := greatest(extract(epoch from p_to - p_from) / (30 * 86400), 0.0001);
  result jsonb;
begin
  if not private.is_platform_admin() and current_user <> 'service_role' then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
  with b as (select id, created_at, currency from public.businesses where archived_at is null),
  ev as (select business_id, type, occurred_at from public.events where occurred_at >= p_from - (p_to - p_from) and occurred_at <= p_to),
  rec_types as (select unnest(array['sale.recorded', 'expense.recorded', 'stock.moved']) t),
  active_now as (select distinct business_id from ev where type in (select t from rec_types) and occurred_at >= p_from),
  active_prev as (select distinct business_id from ev where type in (select t from rec_types) and occurred_at < p_from),
  recs as (
    select business_id, occurred_at, provenance from public.sales where voided_at is null
    union all select business_id, occurred_at, provenance from public.expenses where voided_at is null
  ),
  vo as (
    select o.*, bb.currency from public.outcomes o join b bb on bb.id = o.business_id
    where o.status = 'verified' and o.improved and o.verified_at >= p_from and o.verified_at <= p_to
  ),
  ai as (
    select sum((coalesce(r.input_tokens, 0) * p.usd_per_mtok_in + coalesce(r.output_tokens, 0) * p.usd_per_mtok_out) / 1e6) usd
    from public.agent_runs r left join public.ai_prices p on p.model = r.model
    where r.created_at >= p_from and r.created_at <= p_to
  ),
  costs as (
    select category, sum(amount_usd) usd from public.cost_inputs
    where month >= date_trunc('month', p_from) and month <= p_to group by category
  ),
  revenue as (select coalesce(sum(private.to_usd(amount_minor, currency)), 0) usd from public.revenue_events where occurred_at >= p_from and occurred_at <= p_to),
  ops as (
    select m.user_id, count(distinct e.business_id) n
    from public.program_members m join public.program_enrollments e on e.program_id = m.program_id and e.status = 'active'
    group by m.user_id
  )
  select jsonb_build_object(
    'period', jsonb_build_object('from', p_from, 'to', p_to),
    'product', jsonb_build_object(
      'businesses_total', (select count(*) from b),
      'businesses_created', (select count(*) from b where created_at >= p_from and created_at <= p_to),
      'activated_within_7d', (select count(*) from b where created_at >= p_from and created_at <= p_to and exists (
          select 1 from public.events e where e.business_id = b.id and e.type in ('sale.recorded', 'expense.recorded') and e.occurred_at < b.created_at + interval '7 days')),
      'records_created', (select count(*) from recs where occurred_at >= p_from and occurred_at <= p_to),
      'records_verified', (select count(*) from recs where occurred_at >= p_from and occurred_at <= p_to and provenance <> 'self_reported'),
      'active_businesses', (select count(*) from active_now),
      'retention', (select round(count(*) filter (where business_id in (select business_id from active_now))::numeric / nullif(count(*), 0), 3) from active_prev),
      'maturity', jsonb_build_object(
        'recording', (select count(distinct business_id) from public.events where type in ('sale.recorded', 'expense.recorded')),
        'planning', (select count(distinct business_id) from public.interventions),
        'verified_result', (select count(distinct business_id) from public.outcomes where status = 'verified'),
        'passport_shared', (select count(distinct business_id) from public.passport_shares))),
    'operations', jsonb_build_object(
      'operators', (select count(*) from ops),
      'businesses_per_operator', (select round(avg(n), 1) from ops),
      'open_items', (select count(*) from public.operator_item_log where resolved_at is null),
      'median_resolution_hours', (select round((percentile_cont(0.5) within group (order by extract(epoch from resolved_at - first_seen) / 3600))::numeric, 1)
                                  from public.operator_item_log where resolved_at >= p_from and resolved_at <= p_to),
      'interventions_per_operator', (select round(count(*)::numeric / nullif((select count(*) from ops), 0), 1) from public.interventions where started_at >= p_from and started_at <= p_to)),
    'solutions', jsonb_build_object(
      'activated', (select count(*) from public.interventions where started_at >= p_from and started_at <= p_to),
      'completed', (select count(*) from public.interventions where completed_at >= p_from and completed_at <= p_to and status = 'completed'),
      'verified_outcomes', (select count(*) from vo),
      'verified_outcome_rate', (select round((select count(*) from vo)::numeric / nullif(count(*), 0), 3) from public.interventions
                                where completed_at >= p_from and completed_at <= p_to and status = 'completed')),
    'economics_usd', jsonb_build_object(
      'revenue', (select usd from revenue),
      'ai_cost', (select round(coalesce(usd, 0), 2) from ai),
      'infrastructure_cost', (select coalesce(sum(usd), 0) from costs where category = 'infrastructure'),
      'operator_cost', (select coalesce(sum(usd), 0) from costs where category = 'operator'),
      'other_cost', (select coalesce(sum(usd), 0) from costs where category = 'other'),
      'gross_contribution', (select usd from revenue) - (select round(coalesce(usd, 0), 2) from ai) - (select coalesce(sum(usd), 0) from costs),
      'revenue_per_active_business_month', round((select usd from revenue) / nullif((select count(*) from active_now), 0) / months, 2),
      'cost_per_active_business_month', round(((select coalesce(usd, 0) from ai) + (select coalesce(sum(usd), 0) from costs)) / nullif((select count(*) from active_now), 0) / months, 2)),
    'impact_usd', jsonb_build_object(
      'verified_incremental_revenue', (select coalesce(sum(private.to_usd(delta, currency)), 0) from vo where metric in ('sales_30', 'collected_30')),
      'verified_savings', (select coalesce(sum(private.to_usd(-delta, currency)), 0) from vo where metric = 'expenses_30'),
      'verified_avoided_losses', (select coalesce(sum(private.to_usd(-delta, currency)), 0) from vo where metric in ('receivable_total', 'receivable_over_30')),
      'vei', (select coalesce(sum(case when metric in ('sales_30', 'collected_30') then private.to_usd(delta, currency)
                                        when metric in ('expenses_30', 'receivable_total', 'receivable_over_30') then private.to_usd(-delta, currency) else 0 end), 0) from vo),
      'note', 'VEI = verified incremental revenue + verified savings + verified avoided losses; improvements observed after a plan and checked by a partner, not proof of causation.'),
    'distribution', jsonb_build_object(
      'by_channel', (select coalesce(jsonb_object_agg(channel, n), '{}') from (select channel, count(*) n from public.acquisition_attributions group by 1) x),
      'partner_sourced', (select count(*) from public.acquisition_attributions where channel = 'partner_invite'),
      'program_conversion', (select round(count(*) filter (where status = 'accepted')::numeric / nullif(count(*), 0), 3) from public.program_invitations),
      'programs', (select count(*) from public.programs where status = 'active')),
    'data_moat', jsonb_build_object(
      'longitudinal_businesses_3m', (select count(*) from (select business_id from recs group by business_id
                                      having count(distinct date_trunc('month', occurred_at)) >= 3) x),
      'records_total', (select count(*) from recs),
      'records_verified_total', (select count(*) from recs where provenance <> 'self_reported'),
      'diagnostics', (select count(*) from public.pulse_snapshots),
      'interventions', (select count(*) from public.interventions),
      'outcomes', (select count(*) from public.outcomes),
      'recommendation_feedback', (select count(*) from public.agent_actions where status <> 'proposed'),
      'pulse_feedback', (select count(*) from public.pulse_feedback),
      'extraction_corrections', (select count(*) from public.record_drafts where status = 'confirmed' and fields <> ai_fields))
  ) into result;
  return result;
end $$;

-- Signup-month cohorts: share of businesses with records in each later month.
create function public.cohort_retention(p_months int default 6) returns table (cohort text, size int, month_offset int, active int, rate numeric)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_platform_admin() and current_user <> 'service_role' then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
  return query
  with c as (select id, date_trunc('month', created_at) m from public.businesses where created_at > date_trunc('month', now()) - make_interval(months => p_months)),
  act as (select distinct business_id, date_trunc('month', occurred_at) m from public.events where type in ('sale.recorded', 'expense.recorded', 'stock.moved'))
  select to_char(c.m, 'YYYY-MM'), (select count(*)::int from c c2 where c2.m = c.m), k,
    count(distinct a.business_id)::int,
    round(count(distinct a.business_id)::numeric / (select count(*) from c c2 where c2.m = c.m), 3)
  from c cross join generate_series(0, p_months - 1) k
  left join act a on a.business_id = c.id and a.m = c.m + make_interval(months => k)
  where c.m + make_interval(months => k) <= date_trunc('month', now())
  group by c.m, k order by c.m, k;
end $$;

-- ─── Certification ────────────────────────────────────────────────────────────
create function public.integrity_report() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_platform_admin() and current_user not in ('service_role', 'postgres') then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'sales_items_mismatch', (select count(*) from public.sales s where s.voided_at is null and exists (select 1 from public.sale_items i where i.sale_id = s.id)
                             and s.total_minor <> (select sum(line_total_minor) from public.sale_items i where i.sale_id = s.id)),
    'negative_stock_products', (select count(*) from public.products where stock_qty < 0),
    'confirmed_drafts_without_record', (select count(*) from public.record_drafts where status = 'confirmed' and record_id is null),
    'businesses_without_owner', (select count(*) from public.businesses b where not exists (select 1 from public.memberships m where m.business_id = b.id and m.role = 'owner')),
    'paid_over_total', (select count(*) from public.sales where amount_paid_minor > total_minor),
    'outcomes_on_open_plans', (select count(*) from public.outcomes o join public.interventions i on i.id = o.intervention_id where i.status = 'active'),
    'dead_jobs_7d', (select count(*) from public.jobs where status = 'dead' and finished_at > now() - interval '7 days'),
    'stale_running_jobs', (select count(*) from public.jobs where status = 'running' and locked_at < now() - interval '15 minutes')
  );
end $$;

create function public.security_report() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_platform_admin() and current_user not in ('service_role', 'postgres') then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'tables_without_rls', (select coalesce(jsonb_agg(c.relname), '[]') from pg_class c join pg_namespace n on n.oid = c.relnamespace
                           where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
    'anon_table_grants', (select coalesce(jsonb_agg(distinct table_name), '[]') from information_schema.role_table_grants
                          where grantee = 'anon' and table_schema = 'public'),
    'definer_functions_callable_by_anon', (select coalesce(jsonb_agg(p.proname), '[]') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                          where n.nspname = 'public' and p.prosecdef and has_function_privilege('anon', p.oid, 'execute')),
    'definer_functions_without_search_path', (select coalesce(jsonb_agg(p.proname), '[]') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                          where n.nspname in ('public', 'private') and p.prosecdef
                            and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) cfg where cfg like 'search_path=%')),
    'business_id_without_index', (select coalesce(jsonb_agg(c.relname), '[]') from pg_class c join pg_namespace n on n.oid = c.relnamespace
                          join pg_attribute a on a.attrelid = c.oid and a.attname = 'business_id' and not a.attisdropped
                          where n.nspname = 'public' and c.relkind = 'r'
                            and not exists (select 1 from pg_index i where i.indrelid = c.oid and i.indkey[0] = a.attnum))
  );
end $$;

create function public.rollup_metrics() returns int
language plpgsql security definer set search_path = '' as $$
declare
  m jsonb := public.scale_metrics(now() - interval '30 days', now());
  n int;
begin
  insert into public.metrics_daily (day, key, value)
  select current_date, s.key || '.' || k.key, (k.value)::text::numeric
  from jsonb_each(m) s, jsonb_each(s.value) k
  where jsonb_typeof(s.value) = 'object' and jsonb_typeof(k.value) = 'number'
  on conflict (day, key) do update set value = excluded.value;
  get diagnostics n = row_count;
  return n;
end $$;

revoke execute on function public.scale_metrics(timestamptz, timestamptz), public.cohort_retention(int), public.integrity_report(),
  public.security_report(), public.rollup_metrics() from public, anon;
grant execute on function public.scale_metrics(timestamptz, timestamptz), public.cohort_retention(int), public.integrity_report(),
  public.security_report() to authenticated, service_role;
grant execute on function public.rollup_metrics() to service_role;
revoke execute on function public.rollup_metrics() from authenticated;

alter table public.fx_rates enable row level security;
alter table public.ai_prices enable row level security;
alter table public.cost_inputs enable row level security;
alter table public.revenue_events enable row level security;
alter table public.metrics_daily enable row level security;
alter table public.stripe_events enable row level security;
create policy "fx: read" on public.fx_rates for select to authenticated using (true);
create policy "ai prices: admins" on public.ai_prices for select to authenticated using (private.is_platform_admin());
create policy "costs: admins" on public.cost_inputs for select to authenticated using (private.is_platform_admin());
create policy "revenue: admins" on public.revenue_events for select to authenticated using (private.is_platform_admin());
create policy "metrics: admins" on public.metrics_daily for select to authenticated using (private.is_platform_admin());
revoke insert, update, delete on public.fx_rates, public.ai_prices, public.cost_inputs, public.revenue_events, public.metrics_daily from authenticated;

create function public.add_cost_input(p_month date, p_category text, p_amount_usd numeric, p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_platform_admin() then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
  insert into public.cost_inputs (month, category, amount_usd, note) values (date_trunc('month', p_month)::date, p_category, p_amount_usd, p_note);
end $$;
revoke execute on function public.add_cost_input(date, text, numeric, text) from public, anon;
grant execute on function public.add_cost_input(date, text, numeric, text) to authenticated;

-- ─── Fixes found by security_report() during certification ────────────────────
-- RLS filters by business_id on every read: index it everywhere.
create index sale_items_business_idx on public.sale_items (business_id);
create index stock_movements_business_idx on public.stock_movements (business_id, occurred_at desc);
create index passport_views_business_idx on public.passport_views (business_id, viewed_at desc);
create index partner_assignments_business_idx on public.partner_assignments (business_id);
create index operator_item_log_business_idx on public.operator_item_log (business_id);
create index program_invitations_business_idx on public.program_invitations (business_id) where business_id is not null;
create index solution_engagements_business_idx on public.solution_engagements (business_id);
-- Definer functions granted to authenticated without first revoking PUBLIC.
revoke execute on function public.am_platform_admin(), public.solution_effectiveness(uuid), public.learning_overview() from public, anon;
grant execute on function public.am_platform_admin(), public.solution_effectiveness(uuid), public.learning_overview() to authenticated;
