-- B44 FX integrity. Rates become dated, sourced history; seeds are explicitly placeholders; staleness is
-- detected; revenue keeps its native amount plus a USD snapshot taken at occurrence (never recomputed
-- with today's rate). Market-priced plans let a business be charged in its own currency without FX.

alter table public.fx_rates
  add column is_placeholder boolean not null default true,
  add column fetched_at timestamptz;
update public.fx_rates set is_placeholder = true, source = 'seed: indicative placeholder';

create table public.fx_rate_history (
  id              bigint generated always as identity primary key,
  currency        text not null check (currency ~ '^[A-Z]{3}$'),
  usd_per_unit    numeric not null check (usd_per_unit > 0),
  effective_date  date not null,
  source          text not null,
  is_placeholder  boolean not null default false,
  fetched_at      timestamptz not null default now(),
  unique (currency, effective_date, source)
);
create index fx_rate_history_lookup on public.fx_rate_history (currency, effective_date desc, fetched_at desc);
insert into public.fx_rate_history (currency, usd_per_unit, effective_date, source, is_placeholder, fetched_at)
select currency, usd_per_unit, as_of, 'seed: indicative placeholder', true, now() from public.fx_rates;

insert into public.platform_settings (key, value) values ('fx', '{"max_age_hours": 36}') on conflict (key) do nothing;

-- Rate effective at a moment: latest non-placeholder on/before that date, else latest of any kind.
create function private.fx_rate_at(p_currency text, p_at timestamptz) returns public.fx_rate_history
language sql stable security definer set search_path = '' as $$
  select h.* from public.fx_rate_history h
  where h.currency = upper(p_currency) and h.effective_date <= p_at::date
  order by h.is_placeholder, h.effective_date desc, h.fetched_at desc limit 1;
$$;

-- Provider feed → history (append-only) and the current table. Missing currencies keep their last rate
-- (and become stale); a placeholder is never written over a real rate. History rows are the audit trail.
create function public.record_fx_rates(p_source text, p_effective_date date, p_rates jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare
  k text;
  v numeric;
  n int := 0;
begin
  if char_length(coalesce(p_source, '')) < 3 or p_source like 'seed%' then
    raise exception 'A real rate source is required' using errcode = '22023';
  end if;
  for k, v in select key, value::numeric from jsonb_each_text(p_rates) loop
    if k !~ '^[A-Z]{3}$' or v is null or v <= 0 then
      continue;
    end if;
    insert into public.fx_rate_history (currency, usd_per_unit, effective_date, source, is_placeholder)
    values (k, v, p_effective_date, p_source, false)
    on conflict (currency, effective_date, source) do nothing;
    update public.fx_rates set usd_per_unit = v, as_of = p_effective_date, source = p_source, is_placeholder = false, fetched_at = now()
    where currency = k and (is_placeholder or as_of <= p_effective_date);
    if found then n := n + 1; end if;
  end loop;
  return n;
end $$;

-- ─── Revenue USD snapshot at occurrence ───────────────────────────────────────
alter table public.revenue_events
  add column usd_minor bigint,
  add column fx_rate_id bigint references public.fx_rate_history (id),
  add column fx_placeholder boolean;
create index revenue_events_fx_idx on public.revenue_events (fx_rate_id);

create function private.snapshot_revenue_fx() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  r public.fx_rate_history;
  units smallint;
begin
  if new.usd_minor is not null then
    return new;                                               -- never recomputed
  end if;
  r := private.fx_rate_at(new.currency, coalesce(new.occurred_at, now()));
  select minor_units into units from public.fx_rates where currency = upper(new.currency);
  if r.id is not null then
    new.usd_minor := round(new.amount_minor / power(10::numeric, coalesce(units, 2)) * r.usd_per_unit * 100);
    new.fx_rate_id := r.id;
    new.fx_placeholder := r.is_placeholder;
  end if;
  return new;
end $$;
create trigger revenue_events_fx before insert on public.revenue_events for each row execute function private.snapshot_revenue_fx();
-- Existing rows: snapshot once, flagged as placeholder-based where that is the truth.
update public.revenue_events r set usd_minor = round(r.amount_minor / power(10::numeric, coalesce(f.minor_units, 2)) * h.usd_per_unit * 100),
  fx_rate_id = h.id, fx_placeholder = h.is_placeholder
from public.fx_rate_history h, public.fx_rates f
where h.id = (private.fx_rate_at(r.currency, r.occurred_at)).id and f.currency = r.currency and r.usd_minor is null;

-- ─── Status ───────────────────────────────────────────────────────────────────
create function public.fx_status() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  max_age int := coalesce((select (value ->> 'max_age_hours')::int from public.platform_settings where key = 'fx'), 36);
  rows jsonb;
begin
  if not private.is_platform_admin() then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('currency', f.currency, 'usd_per_unit', f.usd_per_unit, 'source', f.source, 'effective_date', f.as_of,
      'fetched_at', f.fetched_at, 'placeholder', f.is_placeholder,
      'age_hours', case when f.fetched_at is null then null else round(extract(epoch from now() - f.fetched_at) / 3600, 1) end,
      'stale', f.is_placeholder or f.fetched_at is null or f.fetched_at < now() - make_interval(hours => max_age),
      'in_use', exists (select 1 from public.businesses b where b.currency = f.currency) or exists (select 1 from public.revenue_events r where r.currency = f.currency))
    order by f.currency), '[]') into rows from public.fx_rates f;
  return jsonb_build_object(
    'max_age_hours', max_age,
    'rates', rows,
    -- USD totals may be shown externally only when every currency in use has a fresh, real rate.
    'usd_reportable', not exists (select 1 from jsonb_array_elements(rows) x where (x ->> 'in_use')::boolean and (x ->> 'stale')::boolean),
    'revenue_rows_on_placeholder_fx', (select count(*) from public.revenue_events where fx_placeholder is distinct from false),
    'history_rows', (select count(*) from public.fx_rate_history where not is_placeholder));
end $$;

-- ─── Market prices ────────────────────────────────────────────────────────────
create table public.billing_plan_prices (
  plan_id        uuid not null references public.billing_plans (id) on delete cascade,
  currency       text not null check (currency ~ '^[A-Z]{3}$'),
  price_minor    bigint not null check (price_minor >= 0),
  overage_minor  jsonb not null default '{}',
  updated_by     uuid references public.profiles (id),
  updated_at     timestamptz not null default now(),
  primary key (plan_id, currency)
);
create trigger billing_plan_prices_audit after insert or update on public.billing_plan_prices for each row execute function private.audit_row();

alter table public.change_requests drop constraint change_requests_kind_check;
alter table public.change_requests add constraint change_requests_kind_check
  check (kind in ('policy_activation', 'pack_upsert', 'market_upsert', 'dataset_update', 'setting_update', 'plan_price'));

create function public.set_plan_price(p_plan_key text, p_currency text, p_price_minor bigint, p_overage_minor jsonb default '{}') returns void
language plpgsql security definer set search_path = '' as $$
declare
  pid uuid;
begin
  if not private.is_platform_admin() then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
  perform private.require_second_approval('plan_price');
  select id into pid from public.billing_plans where key = p_plan_key;
  if pid is null then
    raise exception 'Unknown plan' using errcode = 'P0002';
  end if;
  if p_currency !~ '^[A-Z]{3}$' or p_price_minor < 0 then
    raise exception 'Give a currency code and a price' using errcode = '22023';
  end if;
  insert into public.billing_plan_prices (plan_id, currency, price_minor, overage_minor, updated_by)
  values (pid, p_currency, p_price_minor, coalesce(p_overage_minor, '{}'), auth.uid())
  on conflict (plan_id, currency) do update set price_minor = excluded.price_minor, overage_minor = excluded.overage_minor,
    updated_by = excluded.updated_by, updated_at = now();
end $$;

-- Price a plan for a business: its market price in its own currency, else the plan's base price.
create function private.plan_price_for(p_plan_id uuid, p_business_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select jsonb_build_object('price_minor', pp.price_minor, 'currency', pp.currency, 'overage_minor', pp.overage_minor)
     from public.billing_plan_prices pp join public.businesses b on b.currency = pp.currency where pp.plan_id = p_plan_id and b.id = p_business_id),
    (select jsonb_build_object('price_minor', price_minor, 'currency', currency, 'overage_minor', overage_minor) from public.billing_plans where id = p_plan_id));
$$;

create or replace function public.decide_change(p_id uuid, p_approve boolean, p_note text default null) returns text
language plpgsql security definer set search_path = '' as $$
declare
  c public.change_requests;
begin
  if not private.is_platform_admin() then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
  select * into c from public.change_requests where id = p_id for update;
  if not found or c.status <> 'pending' then
    raise exception 'Change request not found or already decided' using errcode = 'P0002';
  end if;
  if c.requested_by = auth.uid() then
    raise exception 'A second admin must decide this change' using errcode = '42501';
  end if;
  if not p_approve then
    update public.change_requests set status = 'rejected', decided_by = auth.uid(), decided_at = now(), decision_note = p_note where id = c.id;
    return 'rejected';
  end if;
  begin
    perform set_config('app.applying_change', c.kind, true);
    case c.kind
      when 'policy_activation' then perform public.activate_policy(c.target::uuid);
      when 'pack_upsert' then perform public.upsert_pack(c.target, c.payload ->> 'name', c.payload -> 'definition');
      when 'market_upsert' then perform public.upsert_market(c.payload);
      when 'dataset_update' then perform public.update_dataset(c.target, array(select jsonb_array_elements_text(c.payload -> 'allowed_uses')), (c.payload ->> 'min_group_size')::int);
      when 'setting_update' then perform public.set_platform_setting(c.target, c.payload -> 'value');
      when 'plan_price' then perform public.set_plan_price(c.target, c.payload ->> 'currency', (c.payload ->> 'price_minor')::bigint, coalesce(c.payload -> 'overage_minor', '{}'));
    end case;
    perform set_config('app.applying_change', '', true);
    update public.change_requests set status = 'applied', decided_by = auth.uid(), decided_at = now(), decision_note = p_note where id = c.id;
    return 'applied';
  exception when others then
    perform set_config('app.applying_change', '', true);
    update public.change_requests set status = 'failed', decided_by = auth.uid(), decided_at = now(), decision_note = p_note, error = sqlerrm where id = c.id;
    return 'failed';
  end;
end $$;

create or replace function public.entitlement_status(p_business_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  e public.entitlements;
begin
  if not private.can_read(p_business_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  e := private.active_entitlement(p_business_id);
  return jsonb_build_object(
    'entitlement_id', e.id, 'source', e.source, 'since', e.starts_at,
    'plan', (select jsonb_build_object('key', key, 'name', name) || private.plan_price_for(id, p_business_id) - 'overage_minor' from public.billing_plans where id = e.plan_id),
    'paid_by', coalesce((select name from public.programs where id = e.payer_program_id), (select name from public.providers where id = e.payer_provider_id)),
    'features', (
      select coalesce(jsonb_agg(jsonb_build_object('feature', f.key, 'included', f.value::int,
        'used', (select coalesce(sum(quantity), 0) from public.usage_events u where u.business_id = p_business_id and u.feature = f.key and u.occurred_at >= date_trunc('month', now())),
        'overage_minor', private.plan_price_for(bp.id, p_business_id) -> 'overage_minor' -> f.key) order by f.key), '[]')
      from public.billing_plans bp, jsonb_each(bp.entitlements) f where bp.id = e.plan_id),
    'open_charges', (select count(*) from public.billable_events where business_id = p_business_id and payer_kind = 'business' and status = 'open'),
    'available_plans', (select coalesce(jsonb_agg(jsonb_build_object('key', key, 'name', name, 'entitlements', entitlements) || private.plan_price_for(id, p_business_id) - 'overage_minor'
                          order by price_minor), '[]')
                        from public.billing_plans where payer_kind = 'business' and status = 'active')
  );
end $$;

create or replace function public.rate_billing(p_period date default null) returns int
language plpgsql security definer set search_path = '' as $$
declare
  period date := coalesce(p_period, date_trunc('month', now())::date);
  period_end timestamptz := (period + interval '1 month');
  n int := 0;
  k int;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not private.is_platform_admin() then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;

  -- B44: plan periods and overage are charged at the business's market price, in its own currency.
  insert into public.billable_events (dedupe_key, kind, business_id, entitlement_id, payer_kind, payer_program_id, payer_provider_id, period_start, description, amount_minor, currency)
  select 'plan:' || e.id || ':' || period, 'plan_period', e.business_id, e.id,
    case e.source when 'sponsorship' then 'program' when 'partner' then 'provider' else 'business' end,
    e.payer_program_id, e.payer_provider_id, period, p.name || ' plan · ' || to_char(period, 'Mon YYYY'), (pr ->> 'price_minor')::bigint, pr ->> 'currency'
  from public.entitlements e join public.billing_plans p on p.id = e.plan_id
  cross join lateral private.plan_price_for(p.id, e.business_id) pr
  where (pr ->> 'price_minor')::bigint > 0 and e.starts_at < period_end and (e.ends_at is null or e.ends_at >= period)
  on conflict (dedupe_key) do nothing;
  get diagnostics k = row_count; n := n + k;

  insert into public.billable_events (dedupe_key, kind, business_id, entitlement_id, payer_kind, payer_program_id, payer_provider_id, period_start, description, amount_minor, currency)
  select 'overage:' || e.id || ':' || u.feature || ':' || period, 'overage', e.business_id, e.id,
    case e.source when 'sponsorship' then 'program' when 'partner' then 'provider' else 'business' end,
    e.payer_program_id, e.payer_provider_id, period, u.feature || ' × ' || sum(u.quantity) || ' over plan',
    sum(u.quantity) * (pr -> 'overage_minor' ->> u.feature)::bigint, pr ->> 'currency'
  from public.usage_events u join public.entitlements e on e.id = u.entitlement_id join public.billing_plans p on p.id = e.plan_id
  cross join lateral private.plan_price_for(p.id, e.business_id) pr
  where u.overage and u.occurred_at >= period and u.occurred_at < period_end and (pr -> 'overage_minor') ? u.feature
  group by e.id, e.business_id, e.source, e.payer_program_id, e.payer_provider_id, u.feature, pr
  on conflict (dedupe_key) do update set amount_minor = excluded.amount_minor, description = excluded.description
    where public.billable_events.status = 'open';
  get diagnostics k = row_count; n := n + k;

  -- Provider-led solutions (B17 pricing): the business pays the provider; Foundry keeps its take.
  insert into public.billable_events (dedupe_key, kind, business_id, engagement_id, payer_kind, payee_provider_id, period_start, description, amount_minor, currency)
  select case s.pricing_model when 'monthly' then 'solution:' || g.id || ':' || period else 'solution:' || g.id end,
    'solution_fee', g.business_id, g.id, 'business', g.provider_id, period, s.name || case s.pricing_model when 'monthly' then ' · ' || to_char(period, 'Mon YYYY') else '' end,
    s.price_minor, s.currency
  from public.solution_engagements g
  join public.interventions i on i.id = g.intervention_id
  join public.solution_versions v on v.id = i.solution_version_id join public.solutions s on s.id = v.solution_id
  where s.pricing_model in ('fixed', 'monthly') and coalesce(s.price_minor, 0) > 0 and s.currency is not null
    and g.consented_at < period_end and (s.pricing_model = 'fixed' or g.status = 'active')
  on conflict (dedupe_key) do nothing;
  get diagnostics k = row_count; n := n + k;

  insert into public.billable_events (dedupe_key, kind, business_id, engagement_id, payer_kind, payee_provider_id, description, amount_minor, currency)
  select 'success:' || g.id, 'success_fee', g.business_id, g.id, 'business', g.provider_id, s.name || ' · verified result', s.price_minor, s.currency
  from public.solution_engagements g
  join public.interventions i on i.id = g.intervention_id
  join public.outcomes o on o.intervention_id = i.id and o.status = 'verified' and o.improved
  join public.solution_versions v on v.id = i.solution_version_id join public.solutions s on s.id = v.solution_id
  where s.pricing_model = 'success_fee' and coalesce(s.price_minor, 0) > 0 and s.currency is not null
  on conflict (dedupe_key) do nothing;
  get diagnostics k = row_count; n := n + k;

  -- Dunning: a purchase with a plan charge open for 30+ days lapses back to Free.
  update public.entitlements e set status = 'ended', ends_at = now(), end_reason = 'unpaid'
  where e.status = 'active' and e.source = 'purchase' and exists (
    select 1 from public.billable_events b where b.entitlement_id = e.id and b.kind = 'plan_period' and b.status = 'open' and b.created_at < now() - interval '30 days');
  return n;
end $$;

revoke execute on function public.fx_status(), public.set_plan_price(text, text, bigint, jsonb) from public, anon;
grant execute on function public.fx_status(), public.set_plan_price(text, text, bigint, jsonb) to authenticated;
revoke execute on function public.record_fx_rates(text, date, jsonb) from public, anon, authenticated;
grant execute on function public.record_fx_rates(text, date, jsonb) to service_role;

alter table public.fx_rate_history enable row level security;
alter table public.billing_plan_prices enable row level security;
create policy "fx history: read" on public.fx_rate_history for select to authenticated using (true);
create policy "plan prices: read" on public.billing_plan_prices for select to authenticated using (true);
revoke insert, update, delete on public.fx_rate_history, public.billing_plan_prices from authenticated, anon;
