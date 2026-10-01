-- B13 Solution effectiveness: versioned solutions, per-version funnel
-- ACTIVATED → COMPLETED → IMPROVED → VERIFIED, failure reasons, deprecation.
-- Reuses B11 interventions/outcomes and B9 growth suggestions.

create table public.platform_admins (
  user_id     uuid primary key references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
create policy "platform admins: self" on public.platform_admins for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete on public.platform_admins from authenticated;

create function private.is_platform_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.platform_admins where user_id = (select auth.uid()));
$$;
grant execute on function private.is_platform_admin() to authenticated;
create function public.am_platform_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_platform_admin();
$$;
grant execute on function public.am_platform_admin() to authenticated;

create type public.solution_status as enum ('draft', 'submitted', 'approved', 'active', 'rejected', 'deprecated');

create table public.solutions (
  id                   uuid primary key default gen_random_uuid(),
  key                  text not null unique check (key ~ '^[a-z0-9_]{3,60}$'),
  name                 text not null check (char_length(name) between 3 and 120),
  summary              text not null check (char_length(summary) <= 1000),
  target_dimension     text,
  target_metric        text not null check (private.metric_direction(target_metric) is not null),
  default_window_days  int not null default 30 check (default_window_days between 1 and 180),
  status               public.solution_status not null default 'draft',
  created_at           timestamptz not null default now()
);

create table public.solution_versions (
  id                 uuid primary key default gen_random_uuid(),
  solution_id        uuid not null references public.solutions (id) on delete cascade,
  version            int not null check (version >= 1),
  playbook           jsonb not null default '[]',
  status             text not null default 'active' check (status in ('active', 'deprecated')),
  deprecated_reason  text,
  created_at         timestamptz not null default now(),
  unique (solution_id, version)
);

alter table public.interventions
  add constraint interventions_solution_version_fk foreign key (solution_version_id) references public.solution_versions (id);
create index interventions_solution_idx on public.interventions (solution_version_id) where solution_version_id is not null;

-- Deprecated versions can't start new plans.
create function private.check_solution_version() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.solution_version_id is not null and not exists (
    select 1 from public.solution_versions v join public.solutions s on s.id = v.solution_id
    where v.id = new.solution_version_id and v.status = 'active' and s.status = 'active'
  ) then
    raise exception 'That solution version is no longer offered' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger interventions_solution_check before insert on public.interventions
  for each row execute function private.check_solution_version();

-- Funnel per version (aggregate counts only; no business identities).
create function public.solution_effectiveness(p_solution_id uuid default null) returns table (
  solution_id uuid, solution_key text, solution_name text, version_id uuid, version int, version_status text,
  activated int, completed int, abandoned int, improved int, verified int,
  completion_rate numeric, improvement_rate numeric, verified_rate numeric,
  median_change_pct numeric, failure_reasons jsonb, sample_ok boolean
)
language sql stable security definer set search_path = '' as $$
  with base as (
    select v.solution_id, s.key, s.name, v.id vid, v.version, v.status vstatus, i.id iid, i.status istatus, i.abandon_reason,
           o.improved, o.status ostatus,
           case when o.baseline_value <> 0 then o.delta / abs(o.baseline_value) end change_pct
    from public.solution_versions v
    join public.solutions s on s.id = v.solution_id
    left join public.interventions i on i.solution_version_id = v.id
    left join public.outcomes o on o.intervention_id = i.id
    where p_solution_id is null or v.solution_id = p_solution_id
  ),
  agg as (
    select solution_id, key, name, vid, version, vstatus,
      count(iid)::int activated,
      count(*) filter (where istatus = 'completed')::int completed,
      count(*) filter (where istatus = 'abandoned')::int abandoned,
      count(*) filter (where improved)::int improved,
      count(*) filter (where improved and ostatus = 'verified')::int verified,
      (percentile_cont(0.5) within group (order by change_pct))::numeric median_change
    from base group by solution_id, key, name, vid, version, vstatus
  ),
  reasons as (
    select vid, jsonb_object_agg(reason, n) r from (
      select vid, coalesce(abandon_reason, 'not_improved') reason, count(*) n from base
      where istatus = 'abandoned' or improved = false group by 1, 2
    ) x group by vid
  )
  select a.solution_id, a.key, a.name, a.vid, a.version, a.vstatus, a.activated, a.completed, a.abandoned, a.improved, a.verified,
    round(a.completed::numeric / nullif(a.activated, 0), 3),
    round(a.improved::numeric / nullif(a.completed, 0), 3),
    round(a.verified::numeric / nullif(a.completed, 0), 3),
    round(a.median_change, 3),
    coalesce(r.r, '{}'),
    a.completed >= 5
  from agg a left join reasons r on r.vid = a.vid
  order by name, version;
$$;
grant execute on function public.solution_effectiveness(uuid) to authenticated;

create function public.deprecate_solution_version(p_version_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_platform_admin() then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
  update public.solution_versions set status = 'deprecated', deprecated_reason = p_reason where id = p_version_id;
end $$;

create function public.publish_solution_version(p_solution_id uuid, p_playbook jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  vid uuid;
begin
  if not private.is_platform_admin() then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
  insert into public.solution_versions (solution_id, version, playbook)
  select p_solution_id, coalesce(max(version), 0) + 1, p_playbook from public.solution_versions where solution_id = p_solution_id
  returning id into vid;
  return vid;
end $$;
revoke execute on function public.deprecate_solution_version(uuid, text), public.publish_solution_version(uuid, jsonb) from public, anon;
grant execute on function public.deprecate_solution_version(uuid, text), public.publish_solution_version(uuid, jsonb) to authenticated;

alter table public.solutions enable row level security;
alter table public.solution_versions enable row level security;
create policy "solutions: active visible" on public.solutions for select to authenticated using (status = 'active' or private.is_platform_admin());
create policy "versions: visible with solution" on public.solution_versions for select to authenticated
  using (exists (select 1 from public.solutions s where s.id = solution_id and (s.status = 'active' or private.is_platform_admin())));
revoke insert, update, delete on public.solutions, public.solution_versions from authenticated;

-- Foundry's own starter catalogue (product data, so it ships with the schema).
with s as (
  insert into public.solutions (key, name, summary, target_dimension, target_metric, default_window_days, status) values
    ('collect_overdue', 'Collect overdue debts', 'List everyone who owes you, call the three oldest first, agree a date, and pause new credit for anyone behind.', 'receivables', 'receivable_over_30', 14, 'active'),
    ('daily_record_habit', 'Record every trading day', 'Record sales and spending by voice at close of business, every day for two weeks.', 'record_keeping', 'active_days_30', 14, 'active'),
    ('cost_review', 'Cut one big cost', 'Find your two biggest expense categories and cut or renegotiate one of them this month.', 'cost_control', 'expenses_30', 30, 'active'),
    ('win_back_customers', 'Win back customers', 'Message customers who bought once in the last two months with a thank-you and a small offer.', 'customer_base', 'repeat_customers_60', 30, 'active'),
    ('grow_sales_push', 'Two-week sales push', 'Pick your best-selling item, make sure it is always in stock, and tell every customer about it for two weeks.', 'sales_momentum', 'sales_30', 14, 'active'),
    ('back_your_numbers', 'Back your numbers', 'Photograph receipts and add your mobile money statement so your records are document-backed.', 'evidence_strength', 'records_verified_30', 30, 'active')
  returning id, key
)
insert into public.solution_versions (solution_id, version, playbook)
select id, 1, case key
  when 'collect_overdue' then '["Open Records → Customers and list who owes you","Call or WhatsApp the three oldest debts","Agree a payment date and note it","Pause new credit for anyone behind"]'
  when 'daily_record_habit' then '["Set a daily reminder at closing time","Say the day''s sales and spending into Foundry","Confirm the drafts before you go home"]'
  when 'cost_review' then '["Open Records → Expenses for last month","Pick the two biggest categories","Get one cheaper quote or cut one item"]'
  when 'win_back_customers' then '["List customers who bought once","Send each a thank-you with a small offer","Record any sale that follows"]'
  when 'grow_sales_push' then '["Pick your best seller","Keep it in stock for two weeks","Mention it to every customer"]'
  else '["Photograph receipts when you buy","Add a mobile money or bank statement on the Passport page"]' end::jsonb
from s;
