-- B32 Business memory: a longitudinal timeline of facts, decisions, interventions, outcomes,
-- recurring issues and verifications, with every entry labelled by the evidence hierarchy
-- (verified → confirmed → observed → derived → inferred). AI interpretation is stored as
-- 'inferred' and never mixed with facts. Rebuilt idempotently from sources of record.
-- Reuses B4 events, B5 books, B7 Pulse, B9 agent actions, B11 interventions/outcomes, B24 attestations.

create table public.business_memory (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses (id) on delete cascade,
  kind         text not null check (kind in ('month_summary', 'decision', 'intervention', 'outcome', 'recurring_issue', 'verification', 'interpretation')),
  layer        text not null check (layer in ('verified', 'confirmed', 'observed', 'derived', 'inferred')),
  source_type  text not null,
  source_id    text not null,
  occurred_at  timestamptz not null,
  topic        text,          -- Pulse dimension or metric this entry is about
  title        text not null,
  detail       jsonb not null default '{}',
  refreshed_at timestamptz not null default now(),
  unique (business_id, source_type, source_id)
);
create index business_memory_timeline_idx on public.business_memory (business_id, occurred_at desc);
create index business_memory_topic_idx on public.business_memory (business_id, topic);

-- Pulse dimension ↔ metric, so plans on a metric are remembered under the right topic.
create function private.metric_topic(p_metric text) returns text
language sql immutable set search_path = '' as $$
  select case p_metric
    when 'sales_30' then 'sales_momentum' when 'collected_30' then 'cash_flow' when 'expenses_30' then 'cost_control'
    when 'receivable_total' then 'receivables' when 'receivable_over_30' then 'receivables' when 'active_days_30' then 'record_keeping'
    when 'repeat_customers_60' then 'customer_base' when 'records_verified_30' then 'evidence_strength'
    else p_metric end;
$$;

create function public.refresh_business_memory(p_business_id uuid) returns int
language plpgsql security definer set search_path = '' as $$
declare
  n int := 0;
  k int;
begin
  if not (private.can_read(p_business_id) or coalesce(auth.role(), '') = 'service_role') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  -- Facts: monthly books (confirmed records; share backed by proof noted).
  insert into public.business_memory (business_id, kind, layer, source_type, source_id, occurred_at, topic, title, detail)
  select p_business_id, 'month_summary', 'confirmed', 'month', to_char(m, 'YYYY-MM'), m, 'sales_momentum',
    to_char(m, 'Mon YYYY') || ': ' || coalesce(s.n, 0) || ' sales, ' || coalesce(e.n, 0) || ' expenses',
    jsonb_build_object('sales_minor', coalesce(s.total, 0), 'sales_count', coalesce(s.n, 0), 'expenses_minor', coalesce(e.total, 0),
      'expenses_count', coalesce(e.n, 0), 'backed_share', round(coalesce(s.backed, 0)::numeric / nullif(s.n, 0), 3))
  from (select distinct date_trunc('month', occurred_at) m from public.sales where business_id = p_business_id and voided_at is null
        union select date_trunc('month', occurred_at) from public.expenses where business_id = p_business_id and voided_at is null) months
  left join lateral (select count(*) n, sum(total_minor) total, count(*) filter (where provenance <> 'self_reported') backed
                     from public.sales where business_id = p_business_id and voided_at is null and date_trunc('month', occurred_at) = months.m) s on true
  left join lateral (select count(*) n, sum(amount_minor) total from public.expenses
                     where business_id = p_business_id and voided_at is null and date_trunc('month', occurred_at) = months.m) e on true
  on conflict (business_id, source_type, source_id) do update set title = excluded.title, detail = excluded.detail, refreshed_at = now();
  get diagnostics k = row_count; n := n + k;

  -- Decisions people made on suggestions (confirmed), and the suggestions themselves (inferred).
  insert into public.business_memory (business_id, kind, layer, source_type, source_id, occurred_at, topic, title, detail)
  select a.business_id, 'decision', 'confirmed', 'agent_action', a.id::text, a.decided_at, a.payload ->> 'dimension',
    initcap(a.status::text) || ': ' || a.title, jsonb_build_object('action_type', a.action_type, 'status', a.status, 'generator', a.generator)
  from public.agent_actions a where a.business_id = p_business_id and a.decided_at is not null and a.decided_by is not null
  on conflict (business_id, source_type, source_id) do update set title = excluded.title, detail = excluded.detail, refreshed_at = now();
  get diagnostics k = row_count; n := n + k;
  insert into public.business_memory (business_id, kind, layer, source_type, source_id, occurred_at, topic, title, detail)
  select a.business_id, 'interpretation', 'inferred', 'suggestion', a.id::text, a.created_at, a.payload ->> 'dimension', 'Foundry suggested: ' || a.title,
    jsonb_build_object('body', a.body, 'generator', a.generator, 'rank_score', a.rank_score)
  from public.agent_actions a where a.business_id = p_business_id and a.action_type = 'growth.recommend'
  on conflict (business_id, source_type, source_id) do nothing;
  get diagnostics k = row_count; n := n + k;

  -- Plans (confirmed: the business chose them) and their results (observed or verified).
  insert into public.business_memory (business_id, kind, layer, source_type, source_id, occurred_at, topic, title, detail)
  select i.business_id, 'intervention', 'confirmed', 'intervention', i.id::text, i.started_at, private.metric_topic(i.target_metric),
    'Plan: ' || i.title || ' (' || i.status || ')',
    jsonb_build_object('metric', i.target_metric, 'status', i.status, 'abandon_reason', i.abandon_reason, 'solution_version_id', i.solution_version_id, 'due_at', i.due_at)
  from public.interventions i where i.business_id = p_business_id
  on conflict (business_id, source_type, source_id) do update set title = excluded.title, detail = excluded.detail, refreshed_at = now();
  get diagnostics k = row_count; n := n + k;
  insert into public.business_memory (business_id, kind, layer, source_type, source_id, occurred_at, topic, title, detail)
  select o.business_id, 'outcome', case when o.status = 'verified' then 'verified' else 'observed' end, 'outcome', o.id::text, o.window_end,
    private.metric_topic(o.metric), 'Result of "' || i.title || '": ' || case when o.improved then 'improved' else 'no improvement' end,
    jsonb_build_object('intervention_id', i.id, 'metric', o.metric, 'baseline', o.baseline_value, 'observed', o.observed_value, 'delta', o.delta,
      'improved', o.improved, 'status', o.status)
  from public.outcomes o join public.interventions i on i.id = o.intervention_id where o.business_id = p_business_id
  on conflict (business_id, source_type, source_id) do update set layer = excluded.layer, title = excluded.title, detail = excluded.detail, refreshed_at = now();
  get diagnostics k = row_count; n := n + k;

  -- Recurring issues (derived): a dimension at risk on 3+ of the last 6 Pulse days.
  insert into public.business_memory (business_id, kind, layer, source_type, source_id, occurred_at, topic, title, detail)
  select p_business_id, 'recurring_issue', 'derived', 'recurring', dimension, max(computed_at), dimension,
    replace(dimension, '_', ' ') || ' at risk on ' || count(*) || ' of the last ' || max(total) || ' Pulse checks',
    jsonb_build_object('at_risk', count(*), 'checks', max(total), 'first', min(computed_on), 'last', max(computed_on))
  from (select s.*, count(*) over (partition by s.dimension) total
        from (select * from public.pulse_snapshots where business_id = p_business_id
              and computed_on in (select distinct computed_on from public.pulse_snapshots where business_id = p_business_id order by computed_on desc limit 6)) s) x
  where state = 'at_risk' group by dimension having count(*) >= 3
  on conflict (business_id, source_type, source_id) do update set title = excluded.title, detail = excluded.detail, occurred_at = excluded.occurred_at, refreshed_at = now();
  get diagnostics k = row_count; n := n + k;

  -- Independent verifications (B24).
  insert into public.business_memory (business_id, kind, layer, source_type, source_id, occurred_at, topic, title, detail)
  select a.business_id, 'verification', case when a.status = 'active' and a.result = 'confirmed' then 'verified' else 'observed' end, 'attestation', a.id::text,
    a.attested_at, 'evidence_strength', v.name || ' ' || replace(a.result, '_', ' ') || ' ' || replace(a.claim_type, '_', ' '),
    jsonb_build_object('claim', a.claim, 'status', a.status, 'method', a.method)
  from public.attestations a join public.verifiers v on v.id = a.verifier_id where a.business_id = p_business_id
  on conflict (business_id, source_type, source_id) do update set layer = excluded.layer, title = excluded.title, detail = excluded.detail, refreshed_at = now();
  get diagnostics k = row_count; n := n + k;
  return n;
end $$;

create function public.memory_timeline(p_business_id uuid, p_limit int default 100, p_include_inferred boolean default false) returns setof public.business_memory
language sql stable security definer set search_path = '' as $$
  select * from public.business_memory
  where business_id = p_business_id and private.can_read(p_business_id) and (p_include_inferred or layer <> 'inferred')
  order by occurred_at desc limit least(p_limit, 500);
$$;

-- What the past says about one topic: prior plans with results, declined suggestions, recurrence.
-- Facts only (no inferred entries), each with its evidence layer.
create function public.memory_context(p_business_id uuid, p_topic text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (private.can_read(p_business_id) or coalesce(auth.role(), '') = 'service_role') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'topic', p_topic,
    'prior_plans', (select coalesce(jsonb_agg(jsonb_build_object('title', i.title, 'when', m.occurred_at, 'status', m.detail ->> 'status',
        'solution_version_id', m.detail ->> 'solution_version_id',
        'result', (select jsonb_build_object('improved', o.detail -> 'improved', 'delta', o.detail -> 'delta', 'layer', o.layer)
                   from public.business_memory o where o.business_id = p_business_id and o.kind = 'outcome' and o.detail ->> 'intervention_id' = m.source_id))
        order by m.occurred_at desc), '[]')
      from public.business_memory m join public.interventions i on i.id::text = m.source_id
      where m.business_id = p_business_id and m.kind = 'intervention' and m.topic = p_topic),
    'declined', (select count(*) from public.business_memory where business_id = p_business_id and kind = 'decision' and topic = p_topic and detail ->> 'status' = 'rejected'),
    'recurring', (select detail from public.business_memory where business_id = p_business_id and kind = 'recurring_issue' and topic = p_topic));
end $$;

revoke execute on function public.refresh_business_memory(uuid), public.memory_timeline(uuid, int, boolean), public.memory_context(uuid, text) from public, anon;
grant execute on function public.refresh_business_memory(uuid), public.memory_timeline(uuid, int, boolean), public.memory_context(uuid, text) to authenticated, service_role;

alter table public.business_memory enable row level security;
create policy "memory: readers" on public.business_memory for select to authenticated using (private.can_read(business_id));
revoke insert, update, delete on public.business_memory from authenticated;
