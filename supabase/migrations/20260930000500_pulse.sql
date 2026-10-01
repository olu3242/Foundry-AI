-- Batch 7: Pulse — nine plain-language business-health dimensions.
-- Raw metrics come from SQL (pulse_metrics); scoring lives in TypeScript (lib/pulse) so it is
-- unit-tested and explainable; results are stored as daily snapshots.

create type public.pulse_state as enum ('strong', 'steady', 'watch', 'at_risk', 'insufficient_data');
create type public.pulse_trend as enum ('up', 'flat', 'down', 'unknown');

create table public.pulse_snapshots (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.businesses (id) on delete cascade,
  computed_on   date not null,
  dimension     text not null check (dimension in ('sales_momentum', 'profitability', 'cash_flow', 'cost_control',
                  'customer_base', 'receivables', 'stock_health', 'record_keeping', 'evidence_strength')),
  score         smallint check (score between 0 and 100),
  state         public.pulse_state not null,
  trend         public.pulse_trend not null default 'unknown',
  why           text not null,
  action        text,
  evidence      jsonb not null default '{}',
  computed_at   timestamptz not null default now(),
  unique (business_id, computed_on, dimension)
);
create index pulse_latest_idx on public.pulse_snapshots (business_id, computed_on desc);

alter table public.pulse_snapshots enable row level security;
create policy "pulse: readers" on public.pulse_snapshots for select to authenticated using (private.can_read(business_id));
grant select on public.pulse_snapshots to authenticated;
revoke insert, update, delete on public.pulse_snapshots from authenticated;

-- Raw inputs for one 30-day window ending at p_as_of (days counted in the business's timezone).
create function public.pulse_metrics(p_business_id uuid, p_as_of timestamptz default now()) returns jsonb
language sql stable security definer set search_path = '' as $$
  with b as (select id, timezone from public.businesses where id = p_business_id),
  w as (select p_as_of - interval '30 days' as from30, p_as_of - interval '60 days' as from60, p_as_of as upto),
  live_sales as (
    select s.* from public.sales s, w where s.business_id = p_business_id and s.voided_at is null and s.occurred_at <= w.upto
  ),
  live_exp as (
    select e.* from public.expenses e, w where e.business_id = p_business_id and e.voided_at is null and e.occurred_at <= w.upto
  ),
  cust60 as (
    select customer_id, count(*) n from live_sales, w
    where customer_id is not null and occurred_at >= w.from60 group by customer_id
  ),
  activity as (
    select occurred_at, provenance, source_draft_id from live_sales
    union all select occurred_at, provenance, source_draft_id from live_exp
    union all select sm.occurred_at, sm.provenance, sm.source_draft_id from public.stock_movements sm, w
      where sm.business_id = p_business_id and sm.occurred_at <= w.upto and sm.reason <> 'sale'
  )
  select jsonb_build_object(
    'sales_30',         (select coalesce(sum(total_minor), 0) from live_sales, w where occurred_at >= w.from30),
    'sales_prev_30',    (select coalesce(sum(total_minor), 0) from live_sales, w where occurred_at >= w.from60 and occurred_at < w.from30),
    'sales_count_30',   (select count(*) from live_sales, w where occurred_at >= w.from30),
    'collected_30',     (select coalesce(sum(amount_paid_minor), 0) from live_sales, w where occurred_at >= w.from30),
    'expenses_30',      (select coalesce(sum(amount_minor), 0) from live_exp, w where occurred_at >= w.from30),
    'expenses_prev_30', (select coalesce(sum(amount_minor), 0) from live_exp, w where occurred_at >= w.from60 and occurred_at < w.from30),
    'receivable_total', (select coalesce(sum(total_minor - amount_paid_minor), 0) from live_sales),
    'receivable_over_30', (select coalesce(sum(total_minor - amount_paid_minor), 0) from live_sales, w where occurred_at < w.from30),
    'customers_60',     (select count(*) from cust60),
    'repeat_customers_60', (select count(*) from cust60 where n >= 2),
    'products_count',   (select count(*) from public.products where business_id = p_business_id),
    'products_negative', (select count(*) from public.products where business_id = p_business_id and stock_qty < 0),
    'products_low',     (select count(*) from public.products where business_id = p_business_id
                           and reorder_level is not null and stock_qty >= 0 and stock_qty <= reorder_level),
    'active_days_30',   (select count(distinct (a.occurred_at at time zone b.timezone)::date) from activity a, b, w where a.occurred_at >= w.from30),
    'records_30',       (select count(*) from activity a, w where a.occurred_at >= w.from30),
    'records_captured_30', (select count(*) from activity a, w where a.occurred_at >= w.from30 and a.source_draft_id is not null),
    'records_verified_30', (select count(*) from activity a, w where a.occurred_at >= w.from30 and a.provenance <> 'self_reported'),
    'tenure_days',      (select coalesce(extract(day from p_as_of - min(occurred_at))::int, 0) from activity)
  );
$$;
revoke execute on function public.pulse_metrics(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.pulse_metrics(uuid, timestamptz) to service_role;

-- Event-driven recompute, debounced: bursts of records collapse into one job two minutes later.
create function private.schedule_pulse() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.enqueue_job('pulse.compute', new.business_id, '{}', 'pulse:' || new.business_id,
                              now() + interval '2 minutes', 3, 150::smallint);
  return new;
end $$;
create trigger events_schedule_pulse after insert on public.events
  for each row when (new.type in ('sale.recorded', 'expense.recorded', 'stock.moved', 'sale.voided', 'expense.voided', 'verification.added'))
  execute function private.schedule_pulse();
