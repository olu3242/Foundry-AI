-- B37 Proprietary data layer: governed derived datasets with lineage
--   SOURCE → TRANSFORMATION → FEATURE → USE
-- and consent/purpose boundaries. Businesses can opt out of network use; opted-out businesses are
-- excluded from every cross-business dataset, benchmark and ranking. Small groups are suppressed.
-- Reuses B5/B8 records + provenance, B11 outcomes, B14 benchmarks, B18 ranking, B25 quality, B32 memory.

alter table public.businesses add column data_sharing text not null default 'network' check (data_sharing in ('network', 'none'));

create function public.set_data_sharing(p_business_id uuid, p_network boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.has_role(p_business_id, array['owner']::public.business_role[]) then
    raise exception 'Only the owner can change data sharing' using errcode = '42501';
  end if;
  update public.businesses set data_sharing = case when p_network then 'network' else 'none' end where id = p_business_id;
  perform private.emit_event(p_business_id, 'data_sharing.changed', 'business', p_business_id, jsonb_build_object('network', p_network));
end $$;

create function private.network_ok(bid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select data_sharing = 'network' from public.businesses where id = bid), false);
$$;

-- Existing cross-business features respect the opt-out.
create function private.benchmark_inputs_consent() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  return case when private.network_ok(new.business_id) then new else null end;
end $$;
create trigger benchmark_inputs_consent before insert on private.benchmark_inputs for each row execute function private.benchmark_inputs_consent();

create or replace function public.solution_rank_stats() returns table (solution_version_id uuid, target_dimension text, completed int, verified_improved int)
language sql stable security definer set search_path = '' as $$
  select v.id, s.target_dimension,
    count(*) filter (where i.status = 'completed')::int,
    count(*) filter (where o.improved and o.status = 'verified')::int
  from public.solution_versions v join public.solutions s on s.id = v.solution_id
  left join public.interventions i on i.solution_version_id = v.id and private.network_ok(i.business_id)
  left join public.outcomes o on o.intervention_id = i.id
  where s.status = 'active' and v.status = 'active'
  group by v.id, s.target_dimension;
$$;

create table public.datasets (
  key             text primary key,
  version         int not null default 1,
  purpose         text not null,
  allowed_uses    text[] not null,
  consent_rule    text not null default 'network_opt_in',
  min_group_size  int not null default 5 check (min_group_size >= 5),
  sources         jsonb not null,          -- [{ "table": "...", "columns": [...] }]
  transformation  text not null,
  features        jsonb not null           -- [{ "key": "...", "description": "..." }]
);

create table public.dataset_builds (
  id               uuid primary key default gen_random_uuid(),
  dataset_key      text not null references public.datasets (key),
  version          int not null,
  built_at         timestamptz not null default now(),
  rows             int not null,
  businesses_used  int not null,
  excluded_opt_out int not null,
  suppressed       int not null,
  data             jsonb not null,
  digest           text not null
);
create index dataset_builds_idx on public.dataset_builds (dataset_key, built_at desc);

create table public.feature_uses (
  feature_key  text not null,
  use          text not null,
  consumer     text not null,
  primary key (feature_key, use, consumer)
);

create table public.dataset_access_log (
  id           bigint generated always as identity primary key,
  dataset_key  text not null,
  purpose      text not null,
  allowed      boolean not null,
  actor        uuid,
  at           timestamptz not null default now()
);

insert into public.datasets (key, purpose, allowed_uses, sources, transformation, features) values
  ('operating_patterns', 'How informal businesses trade, by country, sector and month', array['benchmarks', 'forecasting_priors', 'research'],
   '[{"table":"sales","columns":["business_id","occurred_at","total_minor","provenance","voided_at"]},{"table":"businesses","columns":["country_code","sector","data_sharing"]},{"table":"fx_rates","columns":["usd_per_unit"]}]',
   'Per country × sector × month: businesses with records, median monthly sales (USD), median active days, share of proof-backed sales. Opted-out businesses removed; groups under the minimum size suppressed.',
   '[{"key":"median_sales_usd","description":"Median monthly sales per business, USD"},{"key":"median_active_days","description":"Median days with a sale"},{"key":"backed_share","description":"Share of sales backed by a document or better"}]'),
  ('intervention_outcomes', 'Which plans work for which problems', array['ranking', 'decisions', 'experiments', 'research'],
   '[{"table":"interventions","columns":["solution_version_id","target_metric","status"]},{"table":"outcomes","columns":["improved","status","delta"]},{"table":"businesses","columns":["country_code","data_sharing"]}]',
   'Per solution × country: plans started, completed, improved, verified-improved. Opted-out businesses removed; small groups suppressed.',
   '[{"key":"completion_rate","description":"Completed ÷ started"},{"key":"verified_improved_rate","description":"Verified improvements ÷ completed"}]'),
  ('data_quality', 'Where records are thin, stale or unverified', array['operations', 'research'],
   '[{"table":"data_quality_issues","columns":["kind","status"]},{"table":"sales","columns":["provenance"]},{"table":"businesses","columns":["country_code","data_sharing"]}]',
   'Per country: businesses, open issues by kind per business, share of proof-backed sales. Opted-out businesses removed; small groups suppressed.',
   '[{"key":"issues_per_business","description":"Open data-quality issues per business"},{"key":"backed_share","description":"Share of sales backed by proof"}]');

insert into public.feature_uses (feature_key, use, consumer) values
  ('operating_patterns.median_sales_usd', 'benchmarks', 'pack_benchmark / business_benchmark'),
  ('intervention_outcomes.verified_improved_rate', 'ranking', 'solution_rank_stats → growth.recommend'),
  ('intervention_outcomes.verified_improved_rate', 'decisions', 'create_decision'),
  ('intervention_outcomes.completion_rate', 'experiments', 'experiment_results'),
  ('data_quality.issues_per_business', 'operations', 'control_plane');

create function public.build_dataset(p_key text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  d public.datasets;
  rows_ jsonb;
  used int;
  excluded int;
  suppressed int;
  bid uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not private.is_platform_admin() then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
  select * into d from public.datasets where key = p_key;
  select count(*) into excluded from public.businesses where data_sharing = 'none';
  if p_key = 'operating_patterns' then
    with per as (
      select b.country_code, coalesce(b.sector, 'unspecified') sector, date_trunc('month', s.occurred_at)::date as period, s.business_id,
        sum(private.to_usd(s.total_minor, s.currency)) usd, count(distinct s.occurred_at::date) days,
        count(*) filter (where s.provenance <> 'self_reported')::numeric / count(*) backed
      from public.sales s join public.businesses b on b.id = s.business_id
      where s.voided_at is null and b.data_sharing = 'network' and s.occurred_at > now() - interval '12 months'
      group by 1, 2, 3, 4),
    g as (select country_code, sector, period, count(*) n,
            percentile_cont(0.5) within group (order by usd) median_sales_usd, percentile_cont(0.5) within group (order by days) median_active_days,
            avg(backed) backed_share from per group by 1, 2, 3)
    select coalesce(jsonb_agg(to_jsonb(g) order by period, country_code, sector) filter (where n >= d.min_group_size), '[]'),
           count(*) filter (where n < d.min_group_size), (select count(distinct business_id) from per)
      into rows_, suppressed, used from g;
  elsif p_key = 'intervention_outcomes' then
    with per as (
      select s.key solution, b.country_code, i.business_id, i.status, o.improved, o.status ostatus
      from public.interventions i join public.businesses b on b.id = i.business_id
      join public.solution_versions v on v.id = i.solution_version_id join public.solutions s on s.id = v.solution_id
      left join public.outcomes o on o.intervention_id = i.id
      where b.data_sharing = 'network'),
    g as (select solution, country_code, count(*) n, count(*) filter (where status = 'completed') completed,
            count(*) filter (where improved) improved, count(*) filter (where improved and ostatus = 'verified') verified_improved,
            round(count(*) filter (where status = 'completed')::numeric / count(*), 3) completion_rate,
            round(count(*) filter (where improved and ostatus = 'verified')::numeric / nullif(count(*) filter (where status = 'completed'), 0), 3) verified_improved_rate
          from per group by 1, 2)
    select coalesce(jsonb_agg(to_jsonb(g) order by solution, country_code) filter (where n >= d.min_group_size), '[]'),
           count(*) filter (where n < d.min_group_size), (select count(distinct business_id) from per)
      into rows_, suppressed, used from g;
  elsif p_key = 'data_quality' then
    with per as (
      select b.country_code, b.id,
        (select count(*) from public.data_quality_issues q where q.business_id = b.id and q.status = 'open') issues,
        (select count(*) filter (where provenance <> 'self_reported')::numeric / nullif(count(*), 0) from public.sales s where s.business_id = b.id and s.voided_at is null) backed
      from public.businesses b where b.data_sharing = 'network' and b.archived_at is null),
    g as (select country_code, count(*) n, round(avg(issues), 2) issues_per_business, round(avg(backed), 3) backed_share from per group by 1)
    select coalesce(jsonb_agg(to_jsonb(g) order by country_code) filter (where n >= d.min_group_size), '[]'),
           count(*) filter (where n < d.min_group_size), (select count(*) from per)
      into rows_, suppressed, used from g;
  else
    raise exception 'Unknown dataset' using errcode = 'P0002';
  end if;
  insert into public.dataset_builds (dataset_key, version, rows, businesses_used, excluded_opt_out, suppressed, data, digest)
  values (p_key, d.version, jsonb_array_length(rows_), used, excluded, suppressed, rows_, encode(extensions.digest(rows_::text, 'sha256'), 'hex'))
  returning id into bid;
  return bid;
end $$;

-- Purpose-bound read: allowed only for a declared use; every read is logged.
create function public.read_dataset(p_key text, p_purpose text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  ok boolean;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not private.is_platform_admin() then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
  select p_purpose = any (allowed_uses) into ok from public.datasets where key = p_key;
  insert into public.dataset_access_log (dataset_key, purpose, allowed, actor) values (p_key, p_purpose, coalesce(ok, false), auth.uid());
  if not coalesce(ok, false) then
    -- Refusals are returned (not raised) so the refusal itself stays in the access log.
    return jsonb_build_object('error', 'purpose_not_permitted', 'dataset', p_key, 'purpose', p_purpose);
  end if;
  return (select jsonb_build_object('dataset', p_key, 'version', version, 'built_at', built_at, 'rows', data, 'digest', digest)
          from public.dataset_builds where dataset_key = p_key order by built_at desc limit 1);
end $$;

-- Lineage for one feature: where it comes from, how it is made, where it is used.
create function public.feature_lineage(p_feature_key text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  d public.datasets;
begin
  if not private.is_platform_admin() then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
  select * into d from public.datasets where key = split_part(p_feature_key, '.', 1);
  if d.key is null or not exists (select 1 from jsonb_array_elements(d.features) f where f ->> 'key' = split_part(p_feature_key, '.', 2)) then
    raise exception 'Unknown feature' using errcode = 'P0002';
  end if;
  return jsonb_build_object(
    'source', d.sources, 'consent', jsonb_build_object('rule', d.consent_rule, 'min_group_size', d.min_group_size),
    'transformation', jsonb_build_object('dataset', d.key, 'version', d.version, 'description', d.transformation,
      'latest_build', (select jsonb_build_object('at', built_at, 'businesses', businesses_used, 'excluded_opt_out', excluded_opt_out, 'suppressed_groups', suppressed, 'digest', digest)
                       from public.dataset_builds where dataset_key = d.key order by built_at desc limit 1)),
    'feature', (select f from jsonb_array_elements(d.features) f where f ->> 'key' = split_part(p_feature_key, '.', 2)),
    'use', (select coalesce(jsonb_agg(jsonb_build_object('use', use, 'consumer', consumer)), '[]') from public.feature_uses where feature_key = p_feature_key),
    'permitted_uses', d.allowed_uses);
end $$;

create function public.build_all_datasets() returns int
language plpgsql security definer set search_path = '' as $$
declare
  k text;
  n int := 0;
begin
  for k in select key from public.datasets loop
    perform public.build_dataset(k);
    n := n + 1;
  end loop;
  return n;
end $$;

revoke execute on function public.set_data_sharing(uuid, boolean), public.build_dataset(text), public.read_dataset(text, text),
  public.feature_lineage(text), public.build_all_datasets() from public, anon;
grant execute on function public.set_data_sharing(uuid, boolean), public.build_dataset(text), public.read_dataset(text, text),
  public.feature_lineage(text), public.build_all_datasets() to authenticated, service_role;
revoke execute on function public.build_all_datasets() from authenticated;

alter table public.datasets enable row level security;
alter table public.dataset_builds enable row level security;
alter table public.feature_uses enable row level security;
alter table public.dataset_access_log enable row level security;
create policy "datasets: admins" on public.datasets for select to authenticated using (private.is_platform_admin());
create policy "builds: admins" on public.dataset_builds for select to authenticated using (private.is_platform_admin());
create policy "feature uses: admins" on public.feature_uses for select to authenticated using (private.is_platform_admin());
create policy "access log: admins" on public.dataset_access_log for select to authenticated using (private.is_platform_admin());
revoke insert, update, delete on public.datasets, public.dataset_builds, public.feature_uses, public.dataset_access_log from authenticated;
