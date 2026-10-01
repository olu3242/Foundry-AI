-- B31 Vertical operating packs: a vertical is configuration (entities, metrics, Pulse rules,
-- solutions, evidence, benchmarks, workflows) evaluated by bounded, whitelisted engines — no
-- per-vertical code paths. First validated pack: fresh produce traders (perishables).
-- Reuses B5 books, B7 Pulse states, B9/B23 autonomy (workflow reminders), B11 interventions +
-- outcomes (pack metrics become measurable plan targets), B13 solutions, B14 benchmark confidence.

create table public.vertical_packs (
  key          text primary key check (key ~ '^[a-z_]{3,40}$'),
  name         text not null,
  version      int not null default 1,
  status       text not null default 'active' check (status in ('draft', 'active', 'retired')),
  definition   jsonb not null,
  updated_at   timestamptz not null default now()
);

create table public.business_packs (
  business_id   uuid not null references public.businesses (id) on delete cascade,
  pack_key      text not null references public.vertical_packs (key),
  activated_by  uuid default auth.uid() references public.profiles (id),
  activated_at  timestamptz not null default now(),
  primary key (business_id, pack_key)
);
create index business_packs_pack_idx on public.business_packs (pack_key);

-- Records for pack entities (validated against the pack's field spec; same provenance model).
create table public.vertical_records (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses (id) on delete cascade,
  pack_key     text not null references public.vertical_packs (key),
  entity       text not null,
  data         jsonb not null,
  occurred_at  timestamptz not null default now(),
  provenance   public.provenance not null default 'self_reported',
  created_by   uuid default auth.uid() references public.profiles (id),
  created_at   timestamptz not null default now(),
  voided_at    timestamptz
);
create index vertical_records_business_idx on public.vertical_records (business_id, pack_key, entity, occurred_at desc);
create trigger vertical_records_audit after insert or update on public.vertical_records for each row execute function private.audit_row();

alter table public.solutions add column vertical_pack text references public.vertical_packs (key);

-- ─── Seed: fresh produce ──────────────────────────────────────────────────────
insert into public.vertical_packs (key, name, definition) values ('fresh_produce', 'Fresh produce traders', $json$
{
  "description": "Tomatoes, peppers, leafy greens, fruit: stock that spoils in days.",
  "entities": {
    "waste_log": { "label": "Waste log", "fields": {
      "product":  { "type": "text", "required": true, "label": "Product" },
      "quantity": { "type": "number", "required": true, "min": 0, "label": "Quantity thrown away" },
      "reason":   { "type": "enum", "required": true, "values": ["spoiled", "damaged", "unsold"], "label": "Why" } } }
  },
  "metrics": {
    "spoilage_rate": { "label": "Spoilage (share of stock bought, 30 days)", "direction": "down", "format": "percent", "window_days": 30, "type": "ratio",
      "numerator":   { "source": "vertical_records", "entity": "waste_log", "measure": "sum", "field": "quantity" },
      "denominator": { "source": "stock_movements", "reason": "purchase", "measure": "sum_quantity" } },
    "stock_cost_share": { "label": "Stock cost as share of sales (30 days)", "direction": "down", "format": "percent", "window_days": 30, "type": "ratio",
      "numerator":   { "source": "expenses", "category": "Stock / inventory", "measure": "sum_amount" },
      "denominator": { "source": "sales", "measure": "sum_total" } }
  },
  "pulse": [
    { "metric": "spoilage_rate", "at_risk_above": 0.15, "healthy_below": 0.08,
      "explain": "Share of what you bought that was thrown away in the last 30 days.",
      "action": "Buy smaller amounts more often, and sell ripe stock first at a discount." },
    { "metric": "stock_cost_share", "at_risk_above": 0.85, "healthy_below": 0.65,
      "explain": "How much of what you sell goes back into buying stock.",
      "action": "Compare two suppliers this week, or raise prices on your best sellers." }
  ],
  "solutions": ["reduce_spoilage"],
  "evidence": [ { "entity": "waste_log", "label": "Daily waste log" } ],
  "benchmarks": ["spoilage_rate"],
  "workflows": [ { "key": "daily_waste_log", "entity": "waste_log", "cadence_days": 1,
                   "title": "Log today's waste", "body": "Note anything you threw away today, even if it was nothing. It shows where money is lost." } ]
}
$json$);


-- ─── Engines (bounded, whitelisted) ───────────────────────────────────────────
create function private.pack_def(p_metric text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select p.definition -> 'metrics' -> split_part(p_metric, ':', 3)
  from public.vertical_packs p where p.key = split_part(p_metric, ':', 2) and p.status = 'active';
$$;

create function private.pack_measure(bid uuid, side jsonb, pack text, window_days int) returns numeric
language plpgsql stable security definer set search_path = '' as $$
declare
  since timestamptz := now() - make_interval(days => window_days);
  v numeric;
begin
  case side ->> 'source'
    when 'sales' then
      select case side ->> 'measure' when 'count' then count(*) else sum(total_minor) end into v
      from public.sales where business_id = bid and voided_at is null and occurred_at > since;
    when 'expenses' then
      select case side ->> 'measure' when 'count' then count(*) else sum(amount_minor) end into v
      from public.expenses where business_id = bid and voided_at is null and occurred_at > since
        and (side ->> 'category' is null or category = side ->> 'category');
    when 'stock_movements' then
      select case side ->> 'measure' when 'count' then count(*) else sum(abs(quantity_delta)) end into v
      from public.stock_movements where business_id = bid and occurred_at > since
        and (side ->> 'reason' is null or reason::text = side ->> 'reason');
    when 'vertical_records' then
      select case side ->> 'measure' when 'count' then count(*) else sum((data ->> (side ->> 'field'))::numeric) end into v
      from public.vertical_records where business_id = bid and pack_key = pack and entity = side ->> 'entity' and voided_at is null and occurred_at > since;
    else
      raise exception 'Unsupported metric source %', side ->> 'source' using errcode = '22023';
  end case;
  return v;
end $$;

-- Value of a pack metric; null (unknown) when the business has no data for it.
create function private.pack_metric_value(bid uuid, p_metric text) returns numeric
language plpgsql stable security definer set search_path = '' as $$
declare
  d jsonb := private.pack_def(p_metric);
  w int;
  num numeric;
  den numeric;
begin
  if d is null then
    return null;
  end if;
  w := coalesce((d ->> 'window_days')::int, 30);
  num := private.pack_measure(bid, d -> 'numerator', split_part(p_metric, ':', 2), w);
  if d ->> 'type' = 'ratio' then
    den := private.pack_measure(bid, d -> 'denominator', split_part(p_metric, ':', 2), w);
    return case when den is null or den = 0 then null else round(coalesce(num, 0) / den, 4) end;
  end if;
  return num;
end $$;

-- Pack metrics join the B11 metric vocabulary (direction from configuration).
create or replace function private.metric_direction(p_metric text) returns text
language sql stable security definer set search_path = '' as $$
  select case
    when p_metric like 'pack:%:%' then private.pack_def(p_metric) ->> 'direction'
    else case p_metric
      when 'sales_30' then 'up' when 'collected_30' then 'up' when 'active_days_30' then 'up'
      when 'repeat_customers_60' then 'up' when 'records_verified_30' then 'up'
      when 'expenses_30' then 'down' when 'receivable_total' then 'down' when 'receivable_over_30' then 'down'
    end end;
$$;

create or replace function private.metric_value(p_business_id uuid, p_metric text) returns numeric
language sql stable security definer set search_path = '' as $$
  select case when p_metric like 'pack:%:%' then private.pack_metric_value(p_business_id, p_metric)
              else (public.pulse_metrics(p_business_id) ->> p_metric)::numeric end;
$$;

-- The pack's solution (seeded once metric_direction knows pack metrics).
insert into public.solutions (key, name, summary, target_dimension, target_metric, default_window_days, status, vertical_pack)
values ('reduce_spoilage', 'Cut spoilage', 'Buy smaller, more often; sell ripe stock first; log waste daily for two weeks.',
        'stock', 'pack:fresh_produce:spoilage_rate', 14, 'active', 'fresh_produce');
insert into public.solution_versions (solution_id, version, playbook)
select id, 1, '["Split your usual order into two smaller ones", "Put ripe stock at the front with a discount", "Log waste every day"]'
from public.solutions where key = 'reduce_spoilage';

-- Worker measurement path for any metric (core or pack).
create function public.measure_metric(p_business_id uuid, p_metric text) returns numeric
language sql stable security definer set search_path = '' as $$
  select private.metric_value(p_business_id, p_metric);
$$;
revoke execute on function public.measure_metric(uuid, text) from public, anon, authenticated;
grant execute on function public.measure_metric(uuid, text) to service_role;

-- ─── Business-facing RPCs ─────────────────────────────────────────────────────
create function public.activate_pack(p_business_id uuid, p_pack_key text, p_on boolean default true) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.has_role(p_business_id, array['owner']::public.business_role[]) then
    raise exception 'Only the owner can change packs' using errcode = '42501';
  end if;
  if p_on then
    if not exists (select 1 from public.vertical_packs where key = p_pack_key and status = 'active') then
      raise exception 'Unknown pack' using errcode = 'P0002';
    end if;
    insert into public.business_packs (business_id, pack_key) values (p_business_id, p_pack_key) on conflict do nothing;
    perform private.emit_event(p_business_id, 'pack.activated', 'vertical_pack', null, jsonb_build_object('pack', p_pack_key));
  else
    delete from public.business_packs where business_id = p_business_id and pack_key = p_pack_key;
  end if;
end $$;

-- Validates against the pack's entity spec, then records (with an event, like core records).
create function public.record_pack_entry(p_business_id uuid, p_pack_key text, p_entity text, p_data jsonb, p_occurred_at timestamptz default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  spec jsonb;
  f record;
  v jsonb;
  rid uuid;
begin
  if not private.can_write(p_business_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if not exists (select 1 from public.business_packs where business_id = p_business_id and pack_key = p_pack_key) then
    raise exception 'Turn on this pack first' using errcode = 'P0001';
  end if;
  select definition -> 'entities' -> p_entity -> 'fields' into spec from public.vertical_packs where key = p_pack_key;
  if spec is null then
    raise exception 'Unknown entity %', p_entity using errcode = '22023';
  end if;
  for f in select key, value from jsonb_each(spec) loop
    v := p_data -> f.key;
    if (f.value ->> 'required')::boolean and (v is null or v = 'null'::jsonb or v #>> '{}' = '') then
      raise exception '% is required', coalesce(f.value ->> 'label', f.key) using errcode = '22023';
    end if;
    continue when v is null;
    if f.value ->> 'type' = 'number' and (jsonb_typeof(v) <> 'number' or (f.value ? 'min' and (v #>> '{}')::numeric < (f.value ->> 'min')::numeric)) then
      raise exception '% must be a number%', coalesce(f.value ->> 'label', f.key), coalesce(' ≥ ' || (f.value ->> 'min'), '') using errcode = '22023';
    end if;
    if f.value ->> 'type' = 'enum' and not ((f.value -> 'values') @> jsonb_build_array(v)) then
      raise exception '% must be one of %', coalesce(f.value ->> 'label', f.key), f.value -> 'values' using errcode = '22023';
    end if;
  end loop;
  insert into public.vertical_records (business_id, pack_key, entity, data, occurred_at)
  values (p_business_id, p_pack_key, p_entity, (select jsonb_object_agg(k, p_data -> k) from jsonb_object_keys(spec) k where p_data ? k), coalesce(p_occurred_at, now()))
  returning id into rid;
  perform private.emit_event(p_business_id, 'pack.recorded', 'vertical_record', rid, jsonb_build_object('pack', p_pack_key, 'entity', p_entity));
  return rid;
end $$;

-- Pack Pulse: each rule → state with its value, explanation and next action (unknown stays unknown).
create function public.pack_pulse(p_business_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.can_read(p_business_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
      'pack', p.key, 'pack_name', p.name, 'metric', 'pack:' || p.key || ':' || (r ->> 'metric'),
      'label', p.definition -> 'metrics' -> (r ->> 'metric') ->> 'label', 'format', p.definition -> 'metrics' -> (r ->> 'metric') ->> 'format',
      'value', v.value,
      'state', case when v.value is null then 'unknown'
                    when v.value > (r ->> 'at_risk_above')::numeric then 'at_risk'
                    when v.value < (r ->> 'healthy_below')::numeric then 'healthy' else 'watch' end,
      'explain', r ->> 'explain', 'action', r ->> 'action')), '[]')
    from public.business_packs bp join public.vertical_packs p on p.key = bp.pack_key and p.status = 'active',
      jsonb_array_elements(p.definition -> 'pulse') r,
      lateral (select private.pack_metric_value(p_business_id, 'pack:' || p.key || ':' || (r ->> 'metric')) value) v
    where bp.business_id = p_business_id);
end $$;

-- Pack benchmarks across businesses in the pack (B14 rules: min n, confidence, no rankings when weak).
create function public.pack_benchmark(p_business_id uuid, p_metric text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  vals numeric[];
  mine numeric;
  n int;
begin
  if not private.can_read(p_business_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select array_agg(v) filter (where v is not null) into vals from (
    select private.pack_metric_value(bp.business_id, p_metric) v from public.business_packs bp where bp.pack_key = split_part(p_metric, ':', 2)) x;
  n := coalesce(array_length(vals, 1), 0);
  mine := private.pack_metric_value(p_business_id, p_metric);
  return jsonb_build_object('metric', p_metric, 'cohort', 'Businesses using the ' || split_part(p_metric, ':', 2) || ' pack', 'sample', n, 'period', 'last 30 days',
    'confidence', private.confidence_for(n, 1), 'value', mine,
    'median', case when n >= private.benchmark_min_n() then (select percentile_cont(0.5) within group (order by v) from unnest(vals) v) end,
    'note', case when n < private.benchmark_min_n() then 'Too few businesses yet to compare fairly' end);
end $$;

-- Workflow reminders under the owner's autonomy (B23 authority model; ops.pack_workflow).
create function public.run_pack_workflows(p_business_id uuid default null) returns int
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  n int := 0;
  aid uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not private.is_platform_admin() then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
  for r in
    select bp.business_id, p.key pack, w
    from public.business_packs bp join public.vertical_packs p on p.key = bp.pack_key and p.status = 'active',
      jsonb_array_elements(p.definition -> 'workflows') w
    where (p_business_id is null or bp.business_id = p_business_id)
      and not exists (select 1 from public.vertical_records v where v.business_id = bp.business_id and v.pack_key = p.key and v.entity = w ->> 'entity'
                      and v.occurred_at > now() - make_interval(days => (w ->> 'cadence_days')::int))
  loop
    aid := private.ops_act(r.business_id, null::uuid, 'ops.record_request', private.ops_level(r.business_id, 'ops.record_request', 4, 4), 4,
      r.w ->> 'title', r.w ->> 'body', 'pack:' || r.pack || ':' || (r.w ->> 'key') || ':' || to_char(now(), 'YYYY-MM-DD'),
      jsonb_build_object('pack', r.pack, 'workflow', r.w ->> 'key', 'cadence_days', r.w -> 'cadence_days'));
    if aid is not null then n := n + 1; end if;
  end loop;
  return n;
end $$;

-- Admin: add or update a pack from configuration (validated shape; engines stay fixed).
create function public.upsert_pack(p_key text, p_name text, p_definition jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_platform_admin() then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
  if not (p_definition ? 'entities' and p_definition ? 'metrics' and p_definition ? 'pulse') then
    raise exception 'A pack needs entities, metrics and pulse rules' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_each(p_definition -> 'metrics') m
             where m.value ->> 'direction' not in ('up', 'down')
                or m.value -> 'numerator' ->> 'source' not in ('sales', 'expenses', 'stock_movements', 'vertical_records')
                or (m.value ->> 'type' = 'ratio' and m.value -> 'denominator' ->> 'source' not in ('sales', 'expenses', 'stock_movements', 'vertical_records'))) then
    raise exception 'Metrics must use a supported source and direction' using errcode = '22023';
  end if;
  insert into public.vertical_packs (key, name, definition) values (p_key, p_name, p_definition)
  on conflict (key) do update set name = excluded.name, definition = excluded.definition, version = public.vertical_packs.version + 1, updated_at = now();
end $$;

revoke execute on function public.activate_pack(uuid, text, boolean), public.record_pack_entry(uuid, text, text, jsonb, timestamptz),
  public.pack_pulse(uuid), public.pack_benchmark(uuid, text), public.run_pack_workflows(uuid), public.upsert_pack(text, text, jsonb) from public, anon;
grant execute on function public.activate_pack(uuid, text, boolean), public.record_pack_entry(uuid, text, text, jsonb, timestamptz),
  public.pack_pulse(uuid), public.pack_benchmark(uuid, text), public.run_pack_workflows(uuid), public.upsert_pack(text, text, jsonb) to authenticated;

alter table public.vertical_packs enable row level security;
alter table public.business_packs enable row level security;
alter table public.vertical_records enable row level security;
create policy "packs: readable" on public.vertical_packs for select to authenticated using (status = 'active' or private.is_platform_admin());
create policy "business packs: readers" on public.business_packs for select to authenticated using (private.can_read(business_id));
create policy "vertical records: readers" on public.vertical_records for select to authenticated using (private.can_read(business_id));
revoke insert, update, delete on public.vertical_packs, public.business_packs, public.vertical_records from authenticated;
