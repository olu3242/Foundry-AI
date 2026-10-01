-- B56 Real intervention execution, B57 Verified outcomes, B58 Commercial conversion (deltas over B11
-- interventions/outcomes, B13 solutions, B33 decisions, B34 playbooks, B21 billing, B43 payments).
-- Uncertain estimates are never collapsed into verified impact; promised revenue is never revenue.

-- ─── B56: outcome contract, approval, effort ──────────────────────────────────
alter table public.interventions
  add column target_value numeric,
  add column cost_minor bigint check (cost_minor >= 0),
  add column cost_currency text check (cost_currency ~ '^[A-Z]{3}$'),
  add column business_effort_minutes int check (business_effort_minutes between 0 and 100000),
  add column contract_approved_by uuid references public.profiles (id),
  add column contract_approved_at timestamptz;

-- The owner approves the outcome contract (target and cost) for their own plan.
create function public.set_outcome_contract(p_intervention_id uuid, p_target_value numeric, p_cost_minor bigint default null,
  p_business_effort_minutes int default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  i public.interventions;
begin
  select * into i from public.interventions where id = p_intervention_id;
  if not found or not private.has_role(i.business_id, array['owner']::public.business_role[]) then
    raise exception 'Only the owner can approve the plan''s outcome contract' using errcode = '42501';
  end if;
  if p_target_value is null then
    raise exception 'Set a target' using errcode = '22023';
  end if;
  if (i.expected_direction = 'up' and p_target_value <= i.baseline_value) or (i.expected_direction = 'down' and p_target_value >= i.baseline_value) then
    raise exception 'The target must be an improvement on the baseline (%)', i.baseline_value using errcode = '22023';
  end if;
  update public.interventions set target_value = p_target_value, cost_minor = p_cost_minor,
    cost_currency = case when p_cost_minor is not null then (select currency from public.businesses where id = i.business_id) end,
    business_effort_minutes = coalesce(p_business_effort_minutes, business_effort_minutes),
    contract_approved_by = auth.uid(), contract_approved_at = now()
  where id = p_intervention_id;
end $$;

create function private.intervention_execution(p_business_ids uuid[], p_since timestamptz) returns jsonb
language sql stable security definer set search_path = '' as $$
  with i as (select * from public.interventions where business_id = any (p_business_ids) and started_at >= p_since)
  select jsonb_build_object(
    'started', (select count(*) from i),
    'triggered_by_need', (select count(*) from i where source_action_id is not null or solution_version_id is not null
                          or exists (select 1 from public.decisions d where d.intervention_id = i.id)),
    'with_contract', (select count(*) from i where target_value is not null),
    'approved', (select count(*) from i where contract_approved_at is not null),
    'completed', (select count(*) from i where status = 'completed'),
    'abandoned', (select count(*) from i where status = 'abandoned'),
    'completion_rate', round((select count(*) filter (where status = 'completed')::numeric / nullif(count(*) filter (where status <> 'active'), 0) from i), 4),
    'exceptions', (select coalesce(jsonb_object_agg(abandon_reason, n), '{}') from (select abandon_reason, count(*) n from i where status = 'abandoned' group by 1) x),
    'operator_minutes', (select coalesce(sum(t.minutes), 0) from public.operator_touches t join i on i.id = t.intervention_id),
    'ai_runs', (select count(*) from public.agent_runs r join i on i.id = r.subject_id),
    'business_effort_minutes', (select sum(business_effort_minutes) from i),
    'business_effort_reported', (select count(*) from i where business_effort_minutes is not null),
    'cost_native', (select coalesce(jsonb_object_agg(cost_currency, c), '{}') from (select cost_currency, sum(cost_minor) c from i where cost_minor is not null group by 1) x));
$$;

-- ─── B57: evidence ladder and attribution ─────────────────────────────────────
alter table public.outcomes
  add column attribution text not null default 'not_assessed' check (attribution in ('not_assessed', 'likely', 'contributed', 'unlikely')),
  add column attribution_note text check (char_length(attribution_note) <= 500),
  add column attribution_by uuid references public.profiles (id),
  add column attribution_at timestamptz;

-- Attribution is a separate judgement, only on verified outcomes, by the verifying side (partner/program),
-- never by the owner and never automatic.
create function public.assess_attribution(p_outcome_id uuid, p_attribution text, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  o public.outcomes;
begin
  select * into o from public.outcomes where id = p_outcome_id;
  if not found then
    raise exception 'Outcome not found' using errcode = 'P0002';
  end if;
  if o.status <> 'verified' then
    raise exception 'Only verified outcomes can be attributed' using errcode = 'P0001';
  end if;
  if not (public.my_business_role(o.business_id) in ('partner', 'program_admin') or private.is_platform_admin()) then
    raise exception 'Attribution is assessed by the verifying partner or program' using errcode = '42501';
  end if;
  if char_length(coalesce(trim(p_note), '')) < 10 then
    raise exception 'Explain the attribution (what else could explain the change)' using errcode = '22023';
  end if;
  update public.outcomes set attribution = p_attribution, attribution_note = trim(p_note), attribution_by = auth.uid(), attribution_at = now() where id = p_outcome_id;
end $$;

-- OBSERVED (plan finished, no measured result yet) → MEASURED → VERIFIED → ATTRIBUTED. VEI only from
-- verified outcomes, native currency; USD only when FX is reportable (B44).
create function private.outcome_ladder(p_business_ids uuid[], p_since timestamptz) returns jsonb
language sql stable security definer set search_path = '' as $$
  with i as (select * from public.interventions where business_id = any (p_business_ids) and started_at >= p_since),
       o as (select o.*, b.currency from public.outcomes o join i on i.id = o.intervention_id join public.businesses b on b.id = o.business_id),
       v as (select * from o where status = 'verified'),
       vei as (select currency,
                 sum(case when metric in ('sales_30', 'collected_30') and delta > 0 then delta else 0 end) incremental_revenue,
                 sum(case when metric = 'expenses_30' and delta < 0 then -delta else 0 end) cost_savings,
                 sum(case when metric in ('receivable_total', 'receivable_over_30') and delta < 0 then -delta else 0 end) losses_avoided
               from v group by currency)
  select jsonb_build_object(
    'observed', (select count(*) from i where status = 'completed' and not exists (select 1 from o where o.intervention_id = i.id)),
    'measured', (select count(*) from o),
    'measured_improved', (select count(*) from o where improved),
    'verified', (select count(*) from v),
    'verified_improved', (select count(*) from v where improved),
    'disputed', (select count(*) from o where status = 'disputed'),
    'attributed', (select count(*) from v where attribution in ('likely', 'contributed')),
    'attribution_not_assessed', (select count(*) from v where attribution = 'not_assessed'),
    'vei_native', (select coalesce(jsonb_object_agg(currency, jsonb_build_object('incremental_revenue_minor', incremental_revenue,
                     'cost_savings_minor', cost_savings, 'losses_avoided_minor', losses_avoided)), '{}') from vei),
    'vei_note', 'Verified outcomes only, by metric delta over the plan window in native currency (minor units). Not proof of causation unless attributed.');
$$;

-- ─── B58: commercial offers and the canonical funnel ──────────────────────────
create table public.commercial_offers (
  id                 uuid primary key default gen_random_uuid(),
  business_id        uuid not null references public.businesses (id) on delete cascade,
  pilot_id           uuid references public.pilots (id) on delete set null,
  offer_kind         text not null check (offer_kind in ('plan', 'solution', 'program', 'partner')),
  payer_kind         text not null check (payer_kind in ('business', 'sponsor', 'institution', 'partner')),
  plan_key           text,
  amount_minor       bigint not null check (amount_minor >= 0),
  currency           text not null check (currency ~ '^[A-Z]{3}$'),
  status             text not null default 'open' check (status in ('open', 'accepted', 'rejected', 'expired')),
  reason             text check (reason in ('too_expensive', 'no_value_yet', 'no_cash_now', 'prefers_free', 'trust', 'sponsor_pays', 'other')),
  reason_note        text check (char_length(reason_note) <= 500),
  offered_by         uuid not null default auth.uid() references public.profiles (id),
  offered_at         timestamptz not null default now(),
  responded_by       uuid references public.profiles (id),
  responded_at       timestamptz,
  expires_at         timestamptz not null default now() + interval '30 days'
);
create index commercial_offers_business_idx on public.commercial_offers (business_id, offered_at desc);
create index commercial_offers_pilot_idx on public.commercial_offers (pilot_id);
create trigger commercial_offers_audit after insert or update of status on public.commercial_offers for each row execute function private.audit_row();

create function public.make_offer(p_business_id uuid, p_pilot_id uuid, p_offer_kind text, p_payer_kind text, p_plan_key text, p_amount_minor bigint)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  oid_ uuid;
begin
  if not (private.is_platform_admin()
          or (p_pilot_id is not null and exists (select 1 from public.pilot_operators where pilot_id = p_pilot_id and user_id = auth.uid()))) then
    raise exception 'Pilot operators and platform admins make offers' using errcode = '42501';
  end if;
  if p_offer_kind = 'plan' and not exists (select 1 from public.billing_plans where key = p_plan_key and status = 'active') then
    raise exception 'Unknown plan' using errcode = 'P0002';
  end if;
  insert into public.commercial_offers (business_id, pilot_id, offer_kind, payer_kind, plan_key, amount_minor, currency)
  values (p_business_id, p_pilot_id, p_offer_kind, p_payer_kind, p_plan_key, p_amount_minor, (select currency from public.businesses where id = p_business_id))
  returning id into oid_;
  return oid_;
end $$;

-- The owner accepts or rejects (with a reason). Accepting a business-paid plan starts the purchase (B21);
-- the charge, payment and revenue follow through billing and payments — acceptance is not revenue.
create function public.respond_to_offer(p_offer_id uuid, p_accept boolean, p_reason text default null, p_note text default null) returns text
language plpgsql security definer set search_path = '' as $$
declare
  o public.commercial_offers;
begin
  select * into o from public.commercial_offers where id = p_offer_id for update;
  if not found or not private.has_role(o.business_id, array['owner']::public.business_role[]) then
    raise exception 'Offer not found' using errcode = 'P0002';
  end if;
  if o.status <> 'open' or o.expires_at < now() then
    raise exception 'This offer is no longer open' using errcode = 'P0001';
  end if;
  if not p_accept and p_reason is null then
    raise exception 'Tell us why, so the offer can get better' using errcode = '22023';
  end if;
  update public.commercial_offers set status = case when p_accept then 'accepted' else 'rejected' end, reason = p_reason,
    reason_note = nullif(trim(p_note), ''), responded_by = auth.uid(), responded_at = now()
  where id = p_offer_id;
  if p_accept and o.offer_kind = 'plan' and o.payer_kind = 'business' then
    perform public.choose_plan(o.business_id, o.plan_key);
  end if;
  return case when p_accept then 'accepted' else 'rejected' end;
end $$;

-- VALUE EXPERIENCED → OFFER → ACCEPTANCE/REJECTION → CHARGE → PAYMENT → SETTLEMENT → REVENUE.
-- Only settled, provider- or admin-recorded revenue counts; refunds are netted (B43).
create function private.commercial_funnel(p_business_ids uuid[], p_since timestamptz) returns jsonb
language sql stable security definer set search_path = '' as $$
  with ve as (select distinct business_id from (
                 select o.business_id from public.outcomes o where o.business_id = any (p_business_ids) and o.measured_at >= p_since
                 union select f.business_id from public.pulse_feedback f where f.business_id = any (p_business_ids) and f.verdict = 'accurate' and f.created_at >= p_since) x),
       ofr as (select * from public.commercial_offers where business_id = any (p_business_ids) and offered_at >= p_since),
       ch as (select * from public.billable_events where business_id = any (p_business_ids) and created_at >= p_since and amount_minor > 0),
       rev as (select * from public.revenue_events where business_id = any (p_business_ids) and occurred_at >= p_since)
  select jsonb_build_object(
    'value_experienced', (select count(*) from ve),
    'offered', (select count(distinct business_id) from ofr),
    'accepted', (select count(distinct business_id) from ofr where status = 'accepted'),
    'rejected', (select count(distinct business_id) from ofr where status = 'rejected'),
    'rejection_reasons', (select coalesce(jsonb_object_agg(reason, n), '{}') from (select reason, count(*) n from ofr where status = 'rejected' group by 1) x),
    'charged', (select count(distinct business_id) from ch),
    'paid', (select count(distinct business_id) from ch where status = 'paid'),
    'online_payments', (select count(*) from public.payment_requests where business_id = any (p_business_ids) and status in ('succeeded', 'partially_refunded', 'refunded') and created_at >= p_since),
    'revenue_native', (select coalesce(jsonb_object_agg(currency, amt), '{}') from (select currency, sum(amount_minor) amt from rev group by 1) x),
    'by_payer', (select coalesce(jsonb_object_agg(payer_kind, n), '{}') from (select payer_kind, count(*) n from ch where status = 'paid' group by 1) x),
    'unpaid_open_charges', (select count(*) from ch where status = 'open'),
    'churn_reasons', (select coalesce(jsonb_object_agg(coalesce(end_reason, 'unspecified'), n), '{}') from (select end_reason, count(*) n from public.entitlements
                      where business_id = any (p_business_ids) and status = 'ended' and ends_at >= p_since and source = 'purchase' group by 1) x));
$$;

-- ─── Grants and RLS ───────────────────────────────────────────────────────────
revoke execute on function public.set_outcome_contract(uuid, numeric, bigint, int), public.assess_attribution(uuid, text, text),
  public.make_offer(uuid, uuid, text, text, text, bigint), public.respond_to_offer(uuid, boolean, text, text) from public, anon;
grant execute on function public.set_outcome_contract(uuid, numeric, bigint, int), public.assess_attribution(uuid, text, text),
  public.make_offer(uuid, uuid, text, text, text, bigint), public.respond_to_offer(uuid, boolean, text, text) to authenticated;

alter table public.commercial_offers enable row level security;
create policy "offers: business or pilot" on public.commercial_offers for select to authenticated
  using (private.can_read(business_id) or (pilot_id is not null and private.can_see_pilot(pilot_id)) or private.is_platform_admin());
revoke insert, update, delete on public.commercial_offers from authenticated, anon;
