-- B21 Commercialization: plans → entitlements → metered usage → billable events → revenue.
-- Reuses B10 programs (sponsors, Stripe), B17 solution pricing/providers, B20 revenue_events + fx.
-- One product surface; who pays (business, sponsor program, partner provider) is an entitlement
-- attribute, never a separate code path.

create table public.billing_plans (
  id             uuid primary key default gen_random_uuid(),
  key            text not null unique check (key ~ '^[a-z0-9_]{2,40}$'),
  name           text not null,
  payer_kind     text not null check (payer_kind in ('business', 'sponsor', 'partner')),
  price_minor    bigint not null default 0 check (price_minor >= 0),
  currency       text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  -- Included units per calendar month; -1 = unlimited; missing feature = not included.
  entitlements   jsonb not null default '{}',
  -- Optional per-unit price beyond the included amount; without it the limit is hard.
  overage_minor  jsonb not null default '{}',
  status         text not null default 'active' check (status in ('active', 'retired')),
  created_at     timestamptz not null default now()
);
insert into public.billing_plans (key, name, payer_kind, price_minor, entitlements, overage_minor) values
  ('free', 'Free', 'business', 0, '{"capture.ai":300,"plan.start":10,"evidence.package":3}', '{}'),
  ('growth', 'Growth', 'business', 500, '{"capture.ai":2000,"plan.start":50,"evidence.package":20}', '{"capture.ai":1}'),
  ('sponsored_growth', 'Growth (sponsored)', 'sponsor', 300, '{"capture.ai":2000,"plan.start":50,"evidence.package":20}', '{}'),
  ('partner_growth', 'Growth (partner-paid)', 'partner', 300, '{"capture.ai":2000,"plan.start":50,"evidence.package":20}', '{}');

create table public.entitlements (
  id                 uuid primary key default gen_random_uuid(),
  business_id        uuid not null references public.businesses (id) on delete cascade,
  plan_id            uuid not null references public.billing_plans (id),
  source             text not null check (source in ('default', 'purchase', 'sponsorship', 'partner')),
  payer_program_id   uuid references public.programs (id) on delete set null,
  payer_provider_id  uuid references public.providers (id) on delete set null,
  status             text not null default 'active' check (status in ('active', 'ended')),
  starts_at          timestamptz not null default now(),
  ends_at            timestamptz,
  end_reason         text,
  created_by         uuid default auth.uid() references public.profiles (id),
  created_at         timestamptz not null default now()
);
create index entitlements_business_idx on public.entitlements (business_id, status);
create unique index entitlements_one_active_per_payer on public.entitlements
  (business_id, source, coalesce(payer_program_id, payer_provider_id, '00000000-0000-0000-0000-000000000000'::uuid)) where status = 'active';
create trigger entitlements_audit after insert or update on public.entitlements for each row execute function private.audit_row();

create table public.usage_events (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses (id) on delete cascade,
  entitlement_id  uuid not null references public.entitlements (id) on delete cascade,
  feature         text not null,
  quantity        int not null default 1 check (quantity > 0),
  overage         boolean not null default false,
  correlation_id  text not null,
  occurred_at     timestamptz not null default now(),
  unique (feature, correlation_id)
);
create index usage_events_business_idx on public.usage_events (business_id, feature, occurred_at);
create index usage_events_entitlement_idx on public.usage_events (entitlement_id, occurred_at);

alter table public.providers add column take_rate_bps int not null default 1000 check (take_rate_bps between 0 and 10000);
alter table public.programs add column sponsored_plan_id uuid references public.billing_plans (id);

create table public.billable_events (
  id                 uuid primary key default gen_random_uuid(),
  dedupe_key         text not null unique,
  kind               text not null check (kind in ('plan_period', 'overage', 'solution_fee', 'success_fee')),
  business_id        uuid not null references public.businesses (id) on delete cascade,
  entitlement_id     uuid references public.entitlements (id) on delete set null,
  engagement_id      uuid references public.solution_engagements (id) on delete set null,
  payer_kind         text not null check (payer_kind in ('business', 'program', 'provider')),
  payer_program_id   uuid references public.programs (id) on delete set null,
  payer_provider_id  uuid references public.providers (id) on delete set null,
  payee_provider_id  uuid references public.providers (id) on delete set null,  -- null = Foundry
  period_start       date,
  description        text not null,
  amount_minor       bigint not null check (amount_minor >= 0),
  currency           text not null,
  status             text not null default 'open' check (status in ('open', 'paid', 'void')),
  created_at         timestamptz not null default now(),
  settled_at         timestamptz
);
create index billable_events_business_idx on public.billable_events (business_id, status);
create index billable_events_program_idx on public.billable_events (payer_program_id) where payer_program_id is not null;
create trigger billable_events_audit after insert or update on public.billable_events for each row execute function private.audit_row();

alter table public.revenue_events
  add column business_id uuid references public.businesses (id) on delete set null,
  add column billable_event_id uuid unique references public.billable_events (id) on delete set null;
create index revenue_events_business_idx on public.revenue_events (business_id);

-- ─── Entitlement resolution and metering ──────────────────────────────────────
-- The entitlement that governs a business now: whoever pays most specifically wins.
create function private.active_entitlement(bid uuid) returns public.entitlements
language sql stable security definer set search_path = '' as $$
  select e.* from public.entitlements e
  where e.business_id = bid and e.status = 'active' and e.starts_at <= now() and (e.ends_at is null or e.ends_at > now())
  order by case e.source when 'sponsorship' then 1 when 'partner' then 2 when 'purchase' then 3 else 4 end, e.created_at desc
  limit 1;
$$;

create function private.grant_entitlement(bid uuid, plan_key text, src text, program uuid default null, provider uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  eid uuid;
begin
  select id into eid from public.entitlements
  where business_id = bid and source = src and status = 'active'
    and coalesce(payer_program_id, payer_provider_id, '00000000-0000-0000-0000-000000000000'::uuid)
      = coalesce(program, provider, '00000000-0000-0000-0000-000000000000'::uuid);
  if eid is not null then
    update public.entitlements set plan_id = (select id from public.billing_plans where key = plan_key) where id = eid;
    return eid;
  end if;
  insert into public.entitlements (business_id, plan_id, source, payer_program_id, payer_provider_id)
  select bid, p.id, src, program, provider from public.billing_plans p where p.key = plan_key and p.status = 'active'
  returning id into eid;
  if eid is null then
    raise exception 'Unknown plan' using errcode = 'P0001';
  end if;
  perform private.emit_event(bid, 'entitlement.granted', 'entitlement', eid, jsonb_build_object('plan', plan_key, 'source', src));
  return eid;
end $$;

create function private.end_entitlements(bid uuid, src text, program uuid default null, provider uuid default null, reason text default null)
returns void language sql security definer set search_path = '' as $$
  update public.entitlements set status = 'ended', ends_at = now(), end_reason = reason
  where business_id = bid and source = src and status = 'active'
    and (program is null or payer_program_id = program) and (provider is null or payer_provider_id = provider);
$$;

-- Records one unit of a metered feature. Idempotent per correlation id. Returns false (and
-- records nothing) when the governing plan does not allow it.
create function private.use_entitlement(bid uuid, feat text, corr text, qty int default 1) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  e public.entitlements;
  plan public.billing_plans;
  included int;
  used int;
begin
  if exists (select 1 from public.usage_events where feature = feat and correlation_id = corr) then
    return true;
  end if;
  e := private.active_entitlement(bid);
  if e.id is null then
    return false;
  end if;
  select * into plan from public.billing_plans where id = e.plan_id;
  included := (plan.entitlements ->> feat)::int;
  if included is null then
    return false;
  end if;
  select coalesce(sum(quantity), 0) into used from public.usage_events
  where business_id = bid and feature = feat and occurred_at >= date_trunc('month', now());
  if included <> -1 and used + qty > included and plan.overage_minor ->> feat is null then
    return false;
  end if;
  insert into public.usage_events (business_id, entitlement_id, feature, quantity, overage, correlation_id)
  values (bid, e.id, feat, qty, included <> -1 and used + qty > included, corr)
  on conflict (feature, correlation_id) do nothing;
  return true;
end $$;

-- Service-side metering (AI extraction runs in the worker).
create function public.consume_entitlement(p_business_id uuid, p_feature text, p_correlation_id text) returns boolean
language sql security definer set search_path = '' as $$
  select private.use_entitlement(p_business_id, p_feature, p_correlation_id);
$$;
revoke execute on function public.consume_entitlement(uuid, text, text) from public, anon, authenticated;
grant execute on function public.consume_entitlement(uuid, text, text) to service_role;

-- Gates on existing write paths (no redefinition of B11/B16 RPCs).
create function private.meter_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not private.use_entitlement(new.business_id, tg_argv[0], tg_argv[0] || ':' || new.id) then
    raise exception 'Your plan doesn''t include more of this this month. See Plan & usage.' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger interventions_meter before insert on public.interventions for each row execute function private.meter_insert('plan.start');
create trigger evidence_packages_meter before insert on public.evidence_packages for each row execute function private.meter_insert('evidence.package');

-- Every business starts on Free (backfilled for existing ones).
create function private.on_business_created_plan() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.grant_entitlement(new.id, 'free', 'default');
  return new;
end $$;
create trigger businesses_default_plan after insert on public.businesses for each row execute function private.on_business_created_plan();
insert into public.entitlements (business_id, plan_id, source)
select b.id, p.id, 'default' from public.businesses b, public.billing_plans p where p.key = 'free';

-- Sponsored access follows consented enrollment.
create function private.on_enrollment_sponsorship() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  plan_key text;
begin
  select bp.key into plan_key from public.programs p join public.billing_plans bp on bp.id = p.sponsored_plan_id where p.id = new.program_id;
  if new.status = 'active' and plan_key is not null then
    perform private.grant_entitlement(new.business_id, plan_key, 'sponsorship', new.program_id);
  elsif new.status = 'left' then
    perform private.end_entitlements(new.business_id, 'sponsorship', new.program_id, null, 'left program');
  end if;
  return new;
end $$;
create trigger program_enrollments_sponsorship after insert or update of status on public.program_enrollments
  for each row execute function private.on_enrollment_sponsorship();

-- ─── RPCs ─────────────────────────────────────────────────────────────────────
create function public.entitlement_status(p_business_id uuid) returns jsonb
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
    'plan', (select jsonb_build_object('key', key, 'name', name, 'price_minor', price_minor, 'currency', currency) from public.billing_plans where id = e.plan_id),
    'paid_by', coalesce((select name from public.programs where id = e.payer_program_id), (select name from public.providers where id = e.payer_provider_id)),
    'features', (
      select coalesce(jsonb_agg(jsonb_build_object('feature', f.key, 'included', f.value::int,
        'used', (select coalesce(sum(quantity), 0) from public.usage_events u where u.business_id = p_business_id and u.feature = f.key and u.occurred_at >= date_trunc('month', now())),
        'overage_minor', bp.overage_minor -> f.key) order by f.key), '[]')
      from public.billing_plans bp, jsonb_each(bp.entitlements) f where bp.id = e.plan_id),
    'open_charges', (select count(*) from public.billable_events where business_id = p_business_id and payer_kind = 'business' and status = 'open'),
    'available_plans', (select coalesce(jsonb_agg(jsonb_build_object('key', key, 'name', name, 'price_minor', price_minor, 'currency', currency, 'entitlements', entitlements) order by price_minor), '[]')
                        from public.billing_plans where payer_kind = 'business' and status = 'active')
  );
end $$;

-- Owner chooses a business-paid plan (Free ends any purchase).
create function public.choose_plan(p_business_id uuid, p_plan_key text) returns uuid
language plpgsql security definer set search_path = '' as $$
begin
  if not private.has_role(p_business_id, array['owner']::public.business_role[]) then
    raise exception 'Only the owner can change the plan' using errcode = '42501';
  end if;
  if p_plan_key = 'free' then
    perform private.end_entitlements(p_business_id, 'purchase', null, null, 'downgraded');
    return (private.active_entitlement(p_business_id)).id;
  end if;
  if not exists (select 1 from public.billing_plans where key = p_plan_key and payer_kind = 'business' and status = 'active') then
    raise exception 'That plan can''t be bought directly' using errcode = 'P0001';
  end if;
  return private.grant_entitlement(p_business_id, p_plan_key, 'purchase');
end $$;

-- Program admin sponsors a plan for every consenting business (null ends sponsorship).
create function public.sponsor_plan(p_program_id uuid, p_plan_key text) returns int
language plpgsql security definer set search_path = '' as $$
declare
  pid uuid;
  n int := 0;
  r record;
begin
  if not private.is_program_member(p_program_id, array['admin']::public.program_role[]) then
    raise exception 'Program admins only' using errcode = '42501';
  end if;
  if p_plan_key is not null then
    select id into pid from public.billing_plans where key = p_plan_key and payer_kind = 'sponsor' and status = 'active';
    if pid is null then
      raise exception 'That plan can''t be sponsored' using errcode = 'P0001';
    end if;
  end if;
  update public.programs set sponsored_plan_id = pid where id = p_program_id;
  for r in select business_id from public.program_enrollments where program_id = p_program_id and status = 'active' loop
    if pid is null then
      perform private.end_entitlements(r.business_id, 'sponsorship', p_program_id, null, 'sponsorship ended');
    else
      perform private.grant_entitlement(r.business_id, p_plan_key, 'sponsorship', p_program_id);
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;

-- An approved provider pays for a business it is actively engaged with.
create function public.partner_sponsor_business(p_provider_id uuid, p_business_id uuid, p_active boolean default true) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_provider_member(p_provider_id)
     or not exists (select 1 from public.providers where id = p_provider_id and status = 'approved')
     or not exists (select 1 from public.solution_engagements where provider_id = p_provider_id and business_id = p_business_id and status = 'active') then
    raise exception 'Only an approved provider with an active engagement can pay for this business' using errcode = '42501';
  end if;
  if p_active then
    perform private.grant_entitlement(p_business_id, 'partner_growth', 'partner', null, p_provider_id);
  else
    perform private.end_entitlements(p_business_id, 'partner', null, p_provider_id, 'partner ended');
  end if;
end $$;

-- Monthly rating: plan periods, overage and solution fees become billable events. Idempotent
-- (dedupe keys; open overage amounts are refreshed). Unpaid purchases older than 30 days lapse.
create function public.rate_billing(p_period date default null) returns int
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

  insert into public.billable_events (dedupe_key, kind, business_id, entitlement_id, payer_kind, payer_program_id, payer_provider_id, period_start, description, amount_minor, currency)
  select 'plan:' || e.id || ':' || period, 'plan_period', e.business_id, e.id,
    case e.source when 'sponsorship' then 'program' when 'partner' then 'provider' else 'business' end,
    e.payer_program_id, e.payer_provider_id, period, p.name || ' plan · ' || to_char(period, 'Mon YYYY'), p.price_minor, p.currency
  from public.entitlements e join public.billing_plans p on p.id = e.plan_id
  where p.price_minor > 0 and e.starts_at < period_end and (e.ends_at is null or e.ends_at >= period)
  on conflict (dedupe_key) do nothing;
  get diagnostics k = row_count; n := n + k;

  insert into public.billable_events (dedupe_key, kind, business_id, entitlement_id, payer_kind, payer_program_id, payer_provider_id, period_start, description, amount_minor, currency)
  select 'overage:' || e.id || ':' || u.feature || ':' || period, 'overage', e.business_id, e.id,
    case e.source when 'sponsorship' then 'program' when 'partner' then 'provider' else 'business' end,
    e.payer_program_id, e.payer_provider_id, period, u.feature || ' × ' || sum(u.quantity) || ' over plan',
    sum(u.quantity) * (p.overage_minor ->> u.feature)::bigint, p.currency
  from public.usage_events u join public.entitlements e on e.id = u.entitlement_id join public.billing_plans p on p.id = e.plan_id
  where u.overage and u.occurred_at >= period and u.occurred_at < period_end and p.overage_minor ? u.feature
  group by e.id, e.business_id, e.source, e.payer_program_id, e.payer_provider_id, u.feature, p.overage_minor, p.currency
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

-- Payment received (mobile money, bank, card, Stripe). Foundry revenue = full amount, or the
-- take rate for provider fees. Idempotent per billable event.
create function public.settle_billable_event(p_id uuid, p_method text, p_reference text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  b public.billable_events;
  rid uuid;
  foundry_share bigint;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not private.is_platform_admin() then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
  if p_method not in ('stripe', 'mobile_money', 'bank_transfer', 'cash', 'card') or char_length(coalesce(p_reference, '')) < 3 then
    raise exception 'A payment method and reference are required' using errcode = '22023';
  end if;
  select * into b from public.billable_events where id = p_id for update;
  if not found then
    raise exception 'Charge not found' using errcode = 'P0002';
  end if;
  if b.status = 'paid' then
    return (select id from public.revenue_events where billable_event_id = b.id);
  end if;
  if b.status = 'void' then
    raise exception 'That charge was voided' using errcode = 'P0001';
  end if;
  foundry_share := case when b.payee_provider_id is null then b.amount_minor
    else b.amount_minor * (select take_rate_bps from public.providers where id = b.payee_provider_id) / 10000 end;
  update public.billable_events set status = 'paid', settled_at = now() where id = b.id;
  insert into public.revenue_events (source, external_id, program_id, business_id, billable_event_id, amount_minor, currency)
  values (p_method, p_method || ':' || p_reference, b.payer_program_id, b.business_id, b.id, foundry_share, b.currency)
  returning id into rid;
  perform private.emit_event(b.business_id, 'billing.settled', 'billable_event', b.id,
    jsonb_build_object('kind', b.kind, 'amount_minor', b.amount_minor, 'currency', b.currency, 'method', p_method));
  return rid;
end $$;

create function public.void_billable_event(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_platform_admin() then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
  update public.billable_events set status = 'void', description = description || ' · void: ' || coalesce(p_reason, '') where id = p_id and status = 'open';
end $$;

-- Customer → product → entitlement → usage → billable event → revenue, for one revenue row.
create function public.commercial_trace(p_revenue_event_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  r public.revenue_events;
  b public.billable_events;
  e public.entitlements;
begin
  if not private.is_platform_admin() then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
  select * into r from public.revenue_events where id = p_revenue_event_id;
  select * into b from public.billable_events where id = r.billable_event_id;
  select * into e from public.entitlements where id = b.entitlement_id;
  return jsonb_build_object(
    'revenue', jsonb_build_object('id', r.id, 'amount_minor', r.amount_minor, 'currency', r.currency, 'source', r.source, 'reference', r.external_id, 'at', r.occurred_at),
    'billable', case when b.id is null then null else jsonb_build_object('id', b.id, 'kind', b.kind, 'description', b.description, 'amount_minor', b.amount_minor, 'period', b.period_start) end,
    'customer', jsonb_build_object('payer_kind', coalesce(b.payer_kind, case when r.program_id is not null then 'program' end),
      'payer', coalesce((select name from public.programs where id = coalesce(b.payer_program_id, r.program_id)), (select name from public.providers where id = b.payer_provider_id),
                        (select name from public.businesses where id = b.business_id)),
      'beneficiary', (select name from public.businesses where id = b.business_id)),
    'product', coalesce(
      (select jsonb_build_object('type', 'plan', 'key', p.key, 'name', p.name) from public.billing_plans p where p.id = e.plan_id),
      (select jsonb_build_object('type', 'solution', 'name', s.name, 'provider', pr.name) from public.solution_engagements g
         join public.interventions i on i.id = g.intervention_id join public.solution_versions v on v.id = i.solution_version_id
         join public.solutions s on s.id = v.solution_id join public.providers pr on pr.id = g.provider_id where g.id = b.engagement_id),
      (select jsonb_build_object('type', 'program_subscription', 'name', name) from public.programs where id = r.program_id)),
    'entitlement', case when e.id is null then null else jsonb_build_object('id', e.id, 'source', e.source, 'since', e.starts_at, 'status', e.status) end,
    'usage', (select coalesce(jsonb_object_agg(feature, n), '{}') from (
        select feature, sum(quantity) n from public.usage_events
        where entitlement_id = e.id and (b.period_start is null or (occurred_at >= b.period_start and occurred_at < b.period_start + interval '1 month'))
        group by feature) x)
  );
end $$;

create function public.commercial_overview() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_platform_admin() then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'plans', (select coalesce(jsonb_agg(jsonb_build_object('key', p.key, 'name', p.name, 'payer_kind', p.payer_kind, 'price_minor', p.price_minor, 'currency', p.currency,
                'active', (select count(*) from public.entitlements e where e.plan_id = p.id and e.status = 'active')) order by p.price_minor), '[]') from public.billing_plans p),
    'open', (select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'kind', b.kind, 'description', b.description, 'amount_minor', b.amount_minor, 'currency', b.currency,
                'payer_kind', b.payer_kind, 'business', bz.name, 'created_at', b.created_at) order by b.created_at desc), '[]')
             from public.billable_events b join public.businesses bz on bz.id = b.business_id where b.status = 'open'),
    'revenue_30d', (select coalesce(jsonb_agg(x), '[]') from (
        select coalesce(b.payer_kind, case when r.program_id is not null then 'program' else 'unattributed' end) payer_kind, coalesce(b.kind, 'subscription') kind,
          count(*) n, round(sum(private.to_usd(r.amount_minor, r.currency)), 2) usd
        from public.revenue_events r left join public.billable_events b on b.id = r.billable_event_id
        where r.occurred_at > now() - interval '30 days' group by 1, 2 order by 1, 2) x),
    'recent_revenue', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'amount_minor', amount_minor, 'currency', currency, 'source', source, 'at', occurred_at) order by occurred_at desc), '[]')
                       from (select * from public.revenue_events order by occurred_at desc limit 10) r)
  );
end $$;

revoke execute on function public.entitlement_status(uuid), public.choose_plan(uuid, text), public.sponsor_plan(uuid, text),
  public.partner_sponsor_business(uuid, uuid, boolean), public.rate_billing(date), public.settle_billable_event(uuid, text, text),
  public.void_billable_event(uuid, text), public.commercial_trace(uuid), public.commercial_overview() from public, anon;
grant execute on function public.entitlement_status(uuid), public.choose_plan(uuid, text), public.sponsor_plan(uuid, text),
  public.partner_sponsor_business(uuid, uuid, boolean), public.rate_billing(date), public.settle_billable_event(uuid, text, text),
  public.void_billable_event(uuid, text), public.commercial_trace(uuid), public.commercial_overview() to authenticated;

-- ─── RLS ──────────────────────────────────────────────────────────────────────
alter table public.billing_plans enable row level security;
alter table public.entitlements enable row level security;
alter table public.usage_events enable row level security;
alter table public.billable_events enable row level security;
create policy "plans: readable" on public.billing_plans for select to authenticated using (true);
create policy "entitlements: readers" on public.entitlements for select to authenticated using (private.can_read(business_id) or private.is_platform_admin());
create policy "usage: readers" on public.usage_events for select to authenticated using (private.can_read(business_id) or private.is_platform_admin());
create policy "billable: payer or admin" on public.billable_events for select to authenticated using (
  (payer_kind = 'business' and private.can_read(business_id))
  or (payer_program_id is not null and private.is_program_member(payer_program_id, array['admin']::public.program_role[]))
  or (payer_provider_id is not null and private.is_provider_member(payer_provider_id))
  or private.is_platform_admin());
revoke insert, update, delete on public.billing_plans, public.entitlements, public.usage_events, public.billable_events from authenticated;
