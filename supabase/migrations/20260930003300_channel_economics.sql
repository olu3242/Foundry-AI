-- B35 Distribution economics: source → acquisition → activation → retention → outcome → revenue /
-- cost, per channel (and program). CAC and payback appear only where real acquisition-cost
-- evidence exists; otherwise they are null with the reason. Allocated costs are labelled as such.
-- Reuses B15 acquisition attribution, B11/B22 activation + retention, B20 costs/AI prices/fx,
-- B21 revenue attribution.

create table public.channel_costs (
  id          uuid primary key default gen_random_uuid(),
  channel     text not null check (channel in ('partner_invite', 'program_invite', 'program_code', 'organic')),
  program_id  uuid references public.programs (id) on delete set null,
  month       date not null check (extract(day from month) = 1),
  amount_usd  numeric not null check (amount_usd >= 0),
  note        text not null check (char_length(note) between 3 and 300),   -- what the money was (evidence)
  created_by  uuid default auth.uid() references public.profiles (id),
  created_at  timestamptz not null default now()
);
create index channel_costs_month_idx on public.channel_costs (month, channel);

create function public.add_channel_cost(p_channel text, p_month date, p_amount_usd numeric, p_note text, p_program_id uuid default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  cid uuid;
begin
  if not private.is_platform_admin() then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
  insert into public.channel_costs (channel, program_id, month, amount_usd, note)
  values (p_channel, p_program_id, date_trunc('month', p_month)::date, p_amount_usd, p_note) returning id into cid;
  return cid;
end $$;

create function public.channel_economics(p_months int default 6) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  from_at timestamptz := date_trunc('month', now()) - make_interval(months => p_months - 1);
  months numeric := p_months;
  shared_usd numeric;
  active_all int;
begin
  if not private.is_platform_admin() then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
  select coalesce(sum(amount_usd), 0) into shared_usd from public.cost_inputs where month >= from_at::date;
  select count(distinct business_id) into active_all from public.events
  where occurred_at >= from_at and type in ('sale.recorded', 'expense.recorded', 'capture.received');

  return (
    with acq as (
      select a.business_id, a.channel, b.created_at from public.acquisition_attributions a join public.businesses b on b.id = a.business_id
      where b.created_at >= from_at
    ),
    per as (
      select acq.channel, acq.business_id, acq.created_at,
        exists (select 1 from public.events e where e.business_id = acq.business_id and e.type in ('sale.recorded', 'expense.recorded')
                and e.occurred_at < acq.created_at + interval '7 days') activated,
        case when acq.created_at < now() - interval '60 days' then exists (select 1 from public.events e where e.business_id = acq.business_id
                and e.type in ('sale.recorded', 'expense.recorded', 'capture.received')
                and e.occurred_at between acq.created_at + interval '30 days' and acq.created_at + interval '60 days') end retained_30,
        exists (select 1 from public.events e where e.business_id = acq.business_id and e.occurred_at >= from_at
                and e.type in ('sale.recorded', 'expense.recorded', 'capture.received')) active,
        exists (select 1 from public.outcomes o where o.business_id = acq.business_id and o.status = 'verified' and o.improved) verified_outcome,
        (select coalesce(sum(private.to_usd(r.amount_minor, r.currency)), 0) from public.revenue_events r
          where r.business_id = acq.business_id and r.occurred_at >= from_at) revenue_usd,
        (select coalesce(sum(coalesce(ar.input_tokens, 0) * p.usd_per_mtok_in + coalesce(ar.output_tokens, 0) * p.usd_per_mtok_out) / 1e6, 0)
          from public.agent_runs ar left join public.ai_prices p on p.model = ar.model
          where ar.business_id = acq.business_id and ar.created_at >= from_at) ai_usd
      from acq
    ),
    agg as (
      select channel, count(*) acquired, count(*) filter (where activated) activated,
        count(*) filter (where retained_30) retained, count(*) filter (where retained_30 is not null) retention_eligible,
        count(*) filter (where active) active, count(*) filter (where verified_outcome) with_verified_outcome,
        round(sum(revenue_usd), 2) revenue_usd, round(sum(ai_usd), 4) ai_cost_usd
      from per group by channel
    ),
    cost as (select channel, sum(amount_usd) acquisition_usd, jsonb_agg(jsonb_build_object('month', month, 'usd', amount_usd, 'note', note)) evidence
             from public.channel_costs where month >= from_at::date group by channel)
    select jsonb_build_object(
      'period', jsonb_build_object('from', from_at, 'months', p_months),
      'shared_costs_usd', shared_usd,
      'channels', coalesce(jsonb_agg(jsonb_build_object(
        'channel', agg.channel, 'acquired', agg.acquired,
        'activation_rate', round(agg.activated::numeric / nullif(agg.acquired, 0), 3),
        'retention_30_60', case when agg.retention_eligible = 0 then null else round(agg.retained::numeric / agg.retention_eligible, 3) end,
        'retention_sample', agg.retention_eligible,
        'verified_outcome_rate', round(agg.with_verified_outcome::numeric / nullif(agg.acquired, 0), 3),
        'revenue_usd', agg.revenue_usd, 'ai_cost_usd', agg.ai_cost_usd,
        'allocated_shared_cost_usd', round(shared_usd * agg.active / nullif(active_all, 0), 2),
        'contribution_usd', round(agg.revenue_usd - agg.ai_cost_usd - coalesce(shared_usd * agg.active / nullif(active_all, 0), 0), 2),
        'acquisition_cost_usd', cost.acquisition_usd, 'acquisition_cost_evidence', cost.evidence,
        'cac_usd', case when cost.acquisition_usd is null or agg.acquired = 0 then null else round(cost.acquisition_usd / agg.acquired, 2) end,
        'payback_months', case
          when cost.acquisition_usd is null or agg.acquired = 0 then null
          when (agg.revenue_usd - agg.ai_cost_usd - coalesce(shared_usd * agg.active / nullif(active_all, 0), 0)) <= 0 then null
          else round((cost.acquisition_usd / agg.acquired)
                     / ((agg.revenue_usd - agg.ai_cost_usd - coalesce(shared_usd * agg.active / nullif(active_all, 0), 0)) / agg.acquired / months), 1) end,
        'notes', jsonb_strip_nulls(jsonb_build_object(
          'cac', case when cost.acquisition_usd is null then 'No acquisition cost recorded for this channel: CAC unknown' end,
          'payback', case when cost.acquisition_usd is not null and (agg.revenue_usd - agg.ai_cost_usd) <= 0 then 'No positive contribution yet: payback not reached' end,
          'retention', case when agg.retention_eligible = 0 then 'No businesses old enough (60+ days) to measure retention' end,
          'allocation', 'Shared infrastructure/operator costs allocated by active businesses')))
        order by agg.acquired desc), '[]'))
    from agg left join cost on cost.channel = agg.channel
  );
end $$;

revoke execute on function public.add_channel_cost(text, date, numeric, text, uuid), public.channel_economics(int) from public, anon;
grant execute on function public.add_channel_cost(text, date, numeric, text, uuid), public.channel_economics(int) to authenticated;

alter table public.channel_costs enable row level security;
create policy "channel costs: admins" on public.channel_costs for select to authenticated using (private.is_platform_admin());
revoke insert, update, delete on public.channel_costs from authenticated;
