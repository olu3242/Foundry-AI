-- B59 Pilot economics + retention, pilot dashboard and gap loop, B60 Market-proof certification
-- (deltas over B30/B40/B50 surfaces; no new analytics subsystem). Every dashboard value carries a state:
--   value · 0 (measured zero) · N/A (does not apply, e.g. no denominator) · UNKNOWN (not captured)
--   · INSUFFICIENT_EVIDENCE (no real businesses to measure). Only real businesses count.

alter table public.pilots add column operator_hourly_cost_usd numeric check (operator_hourly_cost_usd >= 0);

create function private.metric(p_value numeric, p_state text default null) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object('value', p_value, 'state', coalesce(p_state, case when p_value is null then 'N/A' when p_value = 0 then '0' else 'value' end));
$$;

-- ─── B59: pilot dashboard (real businesses only; test count shown separately) ──
create function public.pilot_dashboard(p_pilot_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  p public.pilots;
  ids uuid[];
  ops uuid[];
  n int;
  test_n int;
  cq jsonb; pc jsonb; ex jsonb; ol jsonb; cf jsonb; op jsonb; fx jsonb;
  maturity jsonb;
  rated int; useful int;
  ai_usd numeric; op_usd numeric; infra_usd numeric; partner_usd numeric; rev_usd numeric; rev_placeholder int;
  ie text := 'INSUFFICIENT_EVIDENCE';
  r jsonb;
begin
  if not private.can_see_pilot(p_pilot_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select * into p from public.pilots where id = p_pilot_id;
  select coalesce(array_agg(pb.business_id), '{}') into ids from public.pilot_businesses pb join public.businesses b on b.id = pb.business_id
  where pb.pilot_id = p_pilot_id and pb.eligible and b.data_class = 'real';
  select count(*) into test_n from public.pilot_businesses pb join public.businesses b on b.id = pb.business_id where pb.pilot_id = p_pilot_id and b.data_class = 'test';
  select coalesce(array_agg(user_id), '{}') into ops from public.pilot_operators where pilot_id = p_pilot_id;
  n := cardinality(ids);
  fx := public.fx_status_internal();

  cq := private.capture_quality(ids, ops);
  pc := private.pulse_calibration(ids);
  ex := private.intervention_execution(ids, p.starts_on::timestamptz);
  ol := private.outcome_ladder(ids, p.starts_on::timestamptz);
  cf := private.commercial_funnel(ids, p.starts_on::timestamptz);
  op := private.pilot_operations(p_pilot_id);
  select coalesce(jsonb_object_agg(lvl, c), '{}') into maturity
  from (select private.record_maturity(b) lvl, count(*) c from unnest(ids) b group by 1) m;
  select coalesce(sum((x ->> 'rated')::int), 0), coalesce(sum((x ->> 'useful')::int), 0) into rated, useful from jsonb_array_elements(pc) x;

  -- Costs (USD; operator cost needs a configured hourly cost, otherwise UNKNOWN)
  select coalesce(sum((coalesce(ar.input_tokens, 0) * pr.usd_per_mtok_in + coalesce(ar.output_tokens, 0) * pr.usd_per_mtok_out) / 1e6), 0) into ai_usd
  from public.agent_runs ar left join public.ai_prices pr on pr.model = ar.model where ar.business_id = any (ids) and ar.created_at >= p.starts_on;
  op_usd := case when p.operator_hourly_cost_usd is not null then (op ->> 'operator_minutes')::numeric / 60 * p.operator_hourly_cost_usd end;
  select coalesce(sum(amount_usd), 0) into partner_usd from public.channel_costs where program_id = p.program_id and month >= date_trunc('month', p.starts_on);
  select coalesce(sum(c.amount_usd), 0) * coalesce(n::numeric / nullif((select count(*) from public.businesses where archived_at is null and data_class = 'real'), 0), 0)
  into infra_usd from public.cost_inputs c where c.category = 'infrastructure' and c.month >= date_trunc('month', p.starts_on);
  select coalesce(sum(usd_minor), 0) / 100.0, count(*) filter (where fx_placeholder is distinct from false) into rev_usd, rev_placeholder
  from public.revenue_events where business_id = any (ids) and occurred_at >= p.starts_on;

  r := jsonb_build_object(
    'real_businesses', n, 'test_businesses_excluded', test_n,
    'invited', private.metric((select count(*) from public.pilot_invites where pilot_id = p_pilot_id)),
    'activated', case when n = 0 then private.metric(null, ie) else private.metric((select count(*) from public.pilot_businesses pb
                   where pb.pilot_id = p_pilot_id and pb.business_id = any (ids) and private.stage_rank(pb.stage) >= 2)) end,
    'record_maturity', case when n = 0 then jsonb_build_object('state', ie) else maturity end,
    'capture_success', case when n = 0 then private.metric(null, ie) else private.metric((cq ->> 'extraction_success_rate')::numeric) end,
    'verification', case when n = 0 then private.metric(null, ie) else private.metric((cq ->> 'verified_records')::numeric) end,
    'useful_pulse', case when n = 0 then private.metric(null, ie) when rated = 0 then private.metric(null, 'UNKNOWN')
                    else private.metric(round(useful::numeric / rated, 4)) end,
    'interventions', case when n = 0 then private.metric(null, ie) else private.metric((ex ->> 'started')::numeric) end,
    'completion', case when n = 0 then private.metric(null, ie) else private.metric((ex ->> 'completion_rate')::numeric) end,
    'measured_outcomes', case when n = 0 then private.metric(null, ie) else private.metric((ol ->> 'measured')::numeric) end,
    'verified_outcomes', case when n = 0 then private.metric(null, ie) else private.metric((ol ->> 'verified')::numeric) end,
    'passport_progress', case when n = 0 then private.metric(null, ie) else private.metric(
                    (select count(distinct business_id) from (select business_id from public.passport_shares where business_id = any (ids) and created_at >= p.starts_on
                     union select business_id from public.attestations where business_id = any (ids) and attested_at >= p.starts_on) x)) end,
    'operator_load', private.metric((op ->> 'businesses_per_operator')::numeric),
    'operator_minutes_per_business', case when n = 0 then private.metric(null, ie) else private.metric((op ->> 'minutes_per_business')::numeric) end,
    'retention', case when n = 0 then private.metric(null, ie) else private.metric(private.pilot_metric(p_pilot_id, 'retention_rate')) end,
    'revenue_native', case when n = 0 then jsonb_build_object('state', ie) else cf -> 'revenue_native' end,
    'revenue_usd', case when n = 0 then private.metric(null, ie) when rev_placeholder > 0 or not (fx ->> 'usd_reportable')::boolean then private.metric(null, 'UNKNOWN')
                   else private.metric(round(rev_usd, 2)) end,
    'cost_usd', case when n = 0 then private.metric(null, ie) when op_usd is null then private.metric(null, 'UNKNOWN')
                else private.metric(round(ai_usd + op_usd + infra_usd + partner_usd, 2)) end,
    'cost_breakdown_usd', jsonb_build_object('ai', round(ai_usd, 2), 'operator', round(op_usd, 2), 'infrastructure', round(infra_usd, 2), 'partner_channel', round(partner_usd, 2)),
    'contribution_usd', case when n = 0 then private.metric(null, ie)
                        when op_usd is null or rev_placeholder > 0 or not (fx ->> 'usd_reportable')::boolean then private.metric(null, 'UNKNOWN')
                        else private.metric(round(rev_usd - ai_usd - op_usd - infra_usd - partner_usd, 2)) end,
    'vei_native', case when n = 0 then jsonb_build_object('state', ie) else ol -> 'vei_native' end,
    'time_to_value_days', case when n = 0 then private.metric(null, ie) else private.metric((
        select round(percentile_cont(0.5) within group (order by d)::numeric, 1) from (
          select extract(epoch from min(t) - pb.joined_at) / 86400 d from public.pilot_businesses pb
          cross join lateral (select f.created_at t from public.pulse_feedback f where f.business_id = pb.business_id and f.verdict = 'accurate' and f.created_at >= pb.joined_at
                              union all select o.measured_at from public.outcomes o where o.business_id = pb.business_id and o.measured_at >= pb.joined_at) v
          where pb.pilot_id = p_pilot_id and pb.business_id = any (ids) group by pb.business_id, pb.joined_at) y)) end,
    'time_to_verified_outcome_days', case when n = 0 then private.metric(null, ie) else private.metric((
        select round(percentile_cont(0.5) within group (order by d)::numeric, 1) from (
          select extract(epoch from min(o.verified_at) - pb.joined_at) / 86400 d from public.pilot_businesses pb
          join public.outcomes o on o.business_id = pb.business_id and o.status = 'verified' and o.verified_at >= pb.joined_at
          where pb.pilot_id = p_pilot_id and pb.business_id = any (ids) group by pb.business_id, pb.joined_at) y)) end,
    'segments', jsonb_build_object(
      'by_maturity', maturity,
      'by_channel', (select coalesce(jsonb_object_agg(channel, c), '{}') from (select a.channel, count(*) c from public.acquisition_attributions a where a.business_id = any (ids) group by 1) s),
      'by_operator', (select coalesce(jsonb_object_agg(coalesce(pr.full_name, pr.email, pr.phone, 'unassigned'), c), '{}') from (select pb.operator_id, count(*) c from public.pilot_businesses pb
                      where pb.pilot_id = p_pilot_id and pb.business_id = any (ids) group by 1) s left join public.profiles pr on pr.id = s.operator_id)),
    'details', jsonb_build_object('capture', cq, 'pulse', pc, 'interventions', ex, 'outcomes', ol, 'commercial', cf, 'operations', op));
  return r;
end $$;

-- fx_status() is admin-only; dashboards for operators/sponsors need only the reportability flag.
create function public.fx_status_internal() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('usd_reportable', not exists (
    select 1 from public.fx_rates f
    where (f.is_placeholder or f.fetched_at is null or f.fetched_at < now() - make_interval(hours => coalesce((select (value ->> 'max_age_hours')::int from public.platform_settings where key = 'fx'), 36)))
      and (exists (select 1 from public.businesses b where b.currency = f.currency) or exists (select 1 from public.revenue_events r where r.currency = f.currency))));
$$;

-- ─── Pilot gap loop ───────────────────────────────────────────────────────────
create table public.pilot_gaps (
  gap_id       text primary key default 'GAP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  pilot_id     uuid references public.pilots (id) on delete cascade,
  batch        text not null check (batch ~ '^B5[1-9]$|^B60$'),
  business_id  uuid references public.businesses (id) on delete set null,      -- null = cohort-level
  problem      text not null check (char_length(problem) between 5 and 500),
  severity     text not null check (severity in ('P0', 'P1', 'P2', 'P3')),
  evidence     text not null check (char_length(evidence) between 3 and 500),
  root_cause   text check (char_length(root_cause) <= 500),
  owner        uuid references public.profiles (id),
  action       text check (char_length(action) <= 500),
  status       text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'backlogged', 'wont_fix')),
  resolution   text check (char_length(resolution) <= 500),
  created_by   uuid not null default auth.uid() references public.profiles (id),
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz
);
create index pilot_gaps_pilot_idx on public.pilot_gaps (pilot_id, status);
create index pilot_gaps_business_idx on public.pilot_gaps (business_id);
create trigger pilot_gaps_audit after insert or update on public.pilot_gaps for each row execute function private.audit_row();

create function public.record_pilot_gap(p_pilot_id uuid, p_batch text, p_business_id uuid, p_problem text, p_severity text, p_evidence text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  gid text;
begin
  if not private.can_see_pilot(p_pilot_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  insert into public.pilot_gaps (pilot_id, batch, business_id, problem, severity, evidence)
  values (p_pilot_id, p_batch, p_business_id, trim(p_problem), p_severity, trim(p_evidence)) returning gap_id into gid;
  return gid;
end $$;

-- P0/P1 gaps may only close with a resolution; P2/P3 may be backlogged (feature-creep rule).
create function public.update_pilot_gap(p_gap_id text, p_status text, p_root_cause text default null, p_action text default null, p_resolution text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  g public.pilot_gaps;
begin
  select * into g from public.pilot_gaps where gap_id = p_gap_id;
  if not found or not private.can_see_pilot(g.pilot_id) then
    raise exception 'Gap not found' using errcode = 'P0002';
  end if;
  if p_status in ('resolved', 'wont_fix') and char_length(coalesce(trim(p_resolution), '')) < 5 then
    raise exception 'Record how it was resolved' using errcode = '22023';
  end if;
  if p_status = 'backlogged' and g.severity in ('P0', 'P1') then
    raise exception 'P0/P1 gaps cannot be backlogged' using errcode = 'P0001';
  end if;
  update public.pilot_gaps set status = p_status, root_cause = coalesce(nullif(trim(p_root_cause), ''), root_cause),
    action = coalesce(nullif(trim(p_action), ''), action), resolution = coalesce(nullif(trim(p_resolution), ''), resolution),
    owner = coalesce(owner, auth.uid()), resolved_at = case when p_status in ('resolved', 'wont_fix') then now() end
  where gap_id = p_gap_id;
end $$;

-- ─── B60: market-proof certification (ten proofs) ─────────────────────────────
insert into public.platform_settings (key, value) values ('market_proof_thresholds', '{
  "production":   {"min_n": 14, "proven": 1.0, "failed": 0.5},
  "record":       {"min_n": 20, "proven": 0.5, "failed": 0.1},
  "intelligence": {"min_n": 30, "proven": 0.6, "failed": 0.3},
  "action":       {"min_n": 20, "proven": 0.4, "failed": 0.1},
  "operations":   {"min_n": 20, "proven": 2.0, "failed": 0.25}
}') on conflict (key) do nothing;

create table public.market_proof_certifications (
  id        uuid primary key default gen_random_uuid(),
  taken_at  timestamptz not null default now(),
  taken_by  uuid references public.profiles (id),
  verdict   text not null check (verdict in ('PROVEN', 'PARTIALLY_PROVEN', 'INSUFFICIENT_EVIDENCE', 'FAILED')),
  result    jsonb not null
);

create function public.market_proof_certification() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  rw jsonb := public.real_world_certification();
  t jsonb := (select value from public.platform_settings where key = 'market_proof_thresholds');
  real_ids uuid[];
  proofs jsonb := '[]';
  st text;
  statuses text[] := '{}';
  n numeric; v numeric;
  k text;
  op_minutes numeric;
begin
  -- (real_world_certification enforces platform-admin access)
  select coalesce(array_agg(id), '{}') into real_ids from public.businesses where data_class = 'real' and archived_at is null;

  -- 1 PRODUCTION: days in the last 30 with successful background work, in a production environment,
  --   with no open critical incident. Value = 1 when clean, 0 when a critical incident is open.
  select count(distinct date_trunc('day', updated_at)) into n from public.jobs where status = 'succeeded' and updated_at > now() - interval '30 days';
  v := case when exists (select 1 from public.incidents where status <> 'resolved' and severity = 'critical') then 0 else 1 end;
  st := case when private.environment() <> 'production' or cardinality(real_ids) = 0 then 'INSUFFICIENT EVIDENCE' else private.cert_status(n, v, t -> 'production') end;
  proofs := proofs || jsonb_build_object('proof', 'PRODUCTION', 'status', st, 'n', n, 'value', v);

  -- 2 ACTIVATION (B50)
  proofs := proofs || (select jsonb_build_object('proof', 'ACTIVATION', 'status', c ->> 'status', 'n', c -> 'n', 'value', c -> 'value') from jsonb_array_elements(rw -> 'claims') c where c ->> 'claim' = 'activation');

  -- 3 RECORD: share of real businesses at R2 or R3
  n := cardinality(real_ids);
  v := (select avg(case when private.record_maturity(b) in ('R2', 'R3') then 1 else 0 end) from unnest(real_ids) b);
  proofs := proofs || jsonb_build_object('proof', 'RECORD', 'status', private.cert_status(n, v, t -> 'record'), 'n', n, 'value', round(v, 4));

  -- 4 INTELLIGENCE: rated Pulse signals that were useful (accurate) on real businesses
  select count(*) filter (where verdict <> 'missed'), avg(case when verdict = 'accurate' then 1 when verdict in ('inaccurate', 'unclear') then 0 end)
  into n, v from public.pulse_feedback where business_id = any (real_ids);
  proofs := proofs || jsonb_build_object('proof', 'INTELLIGENCE', 'status', private.cert_status(n, v, t -> 'intelligence'), 'n', n, 'value', round(v, 4));

  -- 5 ACTION: recommendations acted on (decisions accepted; overrides and rejections count as not acted)
  select count(*) filter (where status in ('accepted', 'overridden', 'rejected')), avg(case when status = 'accepted' then 1 when status in ('overridden', 'rejected') then 0 end)
  into n, v from public.decisions where business_id = any (real_ids);
  proofs := proofs || jsonb_build_object('proof', 'ACTION', 'status', private.cert_status(n, v, t -> 'action'), 'n', n, 'value', round(v, 4));

  -- 6 OUTCOME (B50) · 7 TRUST (B50)
  proofs := proofs || (select jsonb_build_object('proof', 'OUTCOME', 'status', c ->> 'status', 'n', c -> 'n', 'value', c -> 'value') from jsonb_array_elements(rw -> 'claims') c where c ->> 'claim' = 'outcomes');
  proofs := proofs || (select jsonb_build_object('proof', 'TRUST', 'status', c ->> 'status', 'n', c -> 'n', 'value', c -> 'value') from jsonb_array_elements(rw -> 'claims') c where c ->> 'claim' = 'trust');

  -- 8 OPERATIONS: real pilot businesses served per operator-hour (last 30 days); n = operator touches
  select count(*), coalesce(sum(minutes), 0) into n, op_minutes from public.operator_touches where business_id = any (real_ids) and created_at > now() - interval '30 days';
  v := case when op_minutes > 0 then (select count(distinct business_id) from public.pilot_businesses where business_id = any (real_ids) and eligible) / (op_minutes / 60.0) end;
  proofs := proofs || jsonb_build_object('proof', 'OPERATIONS', 'status', private.cert_status(n, v, t -> 'operations'), 'n', n, 'value', round(v, 2));

  -- 9 COMMERCIAL · 10 ECONOMICS (B50)
  proofs := proofs || (select jsonb_build_object('proof', 'COMMERCIAL', 'status', c ->> 'status', 'n', c -> 'n', 'value', c -> 'value') from jsonb_array_elements(rw -> 'claims') c where c ->> 'claim' = 'commercial');
  proofs := proofs || (select jsonb_build_object('proof', 'ECONOMICS', 'status', c ->> 'status', 'n', c -> 'n', 'value', c -> 'value') from jsonb_array_elements(rw -> 'claims') c where c ->> 'claim' = 'unit_economics');

  -- B60 vocabulary uses underscores.
  select jsonb_agg(p || jsonb_build_object('status', replace(p ->> 'status', ' ', '_'))) into proofs from jsonb_array_elements(proofs) p;
  select array_agg(p ->> 'status') into statuses from jsonb_array_elements(proofs) p;
  return jsonb_build_object(
    'verdict', case when 'FAILED' = any (statuses) then 'FAILED'
                    when statuses <@ array['PROVEN'] then 'PROVEN'
                    when statuses <@ array['INSUFFICIENT_EVIDENCE'] then 'INSUFFICIENT_EVIDENCE'
                    else 'PARTIALLY_PROVEN' end,
    'technical', rw -> 'technical',
    'note', 'Derived only from real businesses in a production environment. Software tests can never produce MARKET PROVEN.',
    'real_businesses', cardinality(real_ids), 'environment', private.environment(),
    'proofs', proofs,
    'open_p0_p1_gaps', (select count(*) from public.pilot_gaps where severity in ('P0', 'P1') and status in ('open', 'in_progress')));
end $$;

create function public.certify_market_proof() returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  c jsonb;
  cid uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not private.is_platform_admin() then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
  c := public.market_proof_certification();
  insert into public.market_proof_certifications (taken_by, verdict, result) values (auth.uid(), c ->> 'verdict', c) returning id into cid;
  return cid;
end $$;


-- ─── B50 fix: the daily evidence job (service_role) can certify ─────────────────
-- real_world_evidence / real_world_certification / fx_status were admin-only, so certify_real_world()
-- failed when run by the worker. Same bodies; access = platform admin or the service role.
create or replace function public.fx_status() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  max_age int := coalesce((select (value ->> 'max_age_hours')::int from public.platform_settings where key = 'fx'), 36);
  rows jsonb;
begin
  if not private.is_platform_admin() and coalesce(auth.role(), '') <> 'service_role' then
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
create or replace function public.real_world_evidence() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  t jsonb := (select value from public.platform_settings where key = 'certification_thresholds');
  fx jsonb;
  real_n int;
  act jsonb; outc jsonb; tr jsonb; com jsonb; dist jsonb; ue jsonb; moat jsonb;
  ai_usd numeric; alloc_usd numeric; rev_usd numeric; all_active int; real_active int;
begin
  if not private.is_platform_admin() and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
  fx := public.fx_status();
  select count(*) into real_n from public.businesses where data_class = 'real' and archived_at is null;

  -- B46 activation: real businesses with enough records to be "activated".
  select jsonb_build_object('n', count(*), 'activated', count(*) filter (where recs >= (t -> 'activation' ->> 'activated_records')::int),
      'value', round(avg(case when recs >= (t -> 'activation' ->> 'activated_records')::int then 1 else 0 end), 4),
      'recording_last_14d', count(*) filter (where days14 >= 4),
      'active_last_30d', count(*) filter (where last_act > now() - interval '30 days'),
      'in_pilots', (select count(distinct pb.business_id) from public.pilot_businesses pb join public.businesses b on b.id = pb.business_id where b.data_class = 'real' and pb.eligible))
  into act
  from (select b.id,
          (select count(*) from public.events e where e.business_id = b.id and e.type in ('sale.recorded', 'expense.recorded', 'pack.recorded')) recs,
          (select count(distinct e.occurred_at::date) from public.events e where e.business_id = b.id and e.type in ('sale.recorded', 'expense.recorded', 'pack.recorded') and e.occurred_at > now() - interval '14 days') days14,
          (select max(e.occurred_at) from public.events e where e.business_id = b.id and e.actor_type = 'user') last_act
        from public.businesses b where b.data_class = 'real' and b.archived_at is null) x;

  -- B47 outcomes: verified results only (observed ones are reported, never counted as proof).
  select jsonb_build_object('n', count(*) filter (where o.status = 'verified'), 'value', round(avg(case when o.improved then 1 else 0 end) filter (where o.status = 'verified'), 4),
      'measured', count(*), 'verified_improved', count(*) filter (where o.status = 'verified' and o.improved),
      'interventions', (select count(*) from public.interventions i join public.businesses b on b.id = i.business_id where b.data_class = 'real'),
      'businesses_with_verified_outcome', count(distinct o.business_id) filter (where o.status = 'verified'))
  into outc from public.outcomes o join public.businesses b on b.id = o.business_id where b.data_class = 'real';

  -- B48 trust: third-party attestations and how they hold up; Passport reach.
  select jsonb_build_object('n', count(*), 'value', round(1 - coalesce((select count(*) from public.attestation_disputes d join public.businesses b on b.id = d.business_id
                 where b.data_class = 'real' and d.status = 'upheld')::numeric / nullif(count(*), 0), 0), 4),
      'businesses', count(distinct a.business_id), 'verifiers', count(distinct a.verifier_id),
      'confirmed', count(*) filter (where a.result = 'confirmed'),
      'disputes', (select count(*) from public.attestation_disputes d join public.businesses b on b.id = d.business_id where b.data_class = 'real'),
      'passport_shares', (select count(*) from public.passport_shares s join public.businesses b on b.id = s.business_id where b.data_class = 'real'),
      'passport_views', (select count(*) from public.passport_views v join public.businesses b on b.id = v.business_id where b.data_class = 'real'))
  into tr from public.attestations a join public.businesses b on b.id = a.business_id where b.data_class = 'real';
  if (tr ->> 'businesses')::int < (t -> 'trust' ->> 'min_businesses')::int then
    tr := tr || jsonb_build_object('note', 'fewer businesses than the configured minimum');
  end if;

  -- B49 commercial: provider-confirmed collection from real businesses (native currency; USD only if reportable).
  select jsonb_build_object('n', count(distinct pr.business_id) filter (where pr.status in ('succeeded', 'partially_refunded', 'refunded')),
      'value', round((count(*) filter (where pr.status in ('succeeded', 'partially_refunded', 'refunded')))::numeric
                     / nullif(count(*) filter (where pr.status not in ('created', 'pending')), 0), 4),
      'attempts', count(*), 'held', count(*) filter (where pr.status in ('mismatch', 'duplicate', 'disputed')),
      'collected_native', (select coalesce(jsonb_object_agg(currency, amt), '{}') from (select r.currency, sum(r.amount_minor) amt from public.revenue_events r
                           join public.businesses b on b.id = r.business_id where b.data_class = 'real' group by 1) x),
      'sponsor_paid_charges', (select count(*) from public.billable_events be join public.businesses b on b.id = be.business_id
                               where b.data_class = 'real' and be.payer_kind = 'program' and be.status = 'paid'))
  into com from public.payment_requests pr join public.businesses b on b.id = pr.business_id where b.data_class = 'real';

  select jsonb_build_object('n', count(*), 'value', round(avg(case when a.channel <> 'organic' then 1 else 0 end), 4),
      'by_channel', (select coalesce(jsonb_object_agg(channel, c), '{}') from (select a2.channel, count(*) c from public.acquisition_attributions a2
                     join public.businesses b2 on b2.id = a2.business_id where b2.data_class = 'real' group by 1) y))
  into dist from public.acquisition_attributions a join public.businesses b on b.id = a.business_id where b.data_class = 'real';

  -- Unit economics: USD snapshot revenue − AI cost − allocated cost, for real businesses, last 90 days.
  select coalesce(sum(r.usd_minor), 0) / 100.0 into rev_usd from public.revenue_events r join public.businesses b on b.id = r.business_id
  where b.data_class = 'real' and r.occurred_at > now() - interval '90 days' and r.fx_placeholder is false;
  select coalesce(sum((coalesce(ar.input_tokens, 0) * p.usd_per_mtok_in + coalesce(ar.output_tokens, 0) * p.usd_per_mtok_out) / 1e6), 0) into ai_usd
  from public.agent_runs ar join public.businesses b on b.id = ar.business_id left join public.ai_prices p on p.model = ar.model
  where b.data_class = 'real' and ar.created_at > now() - interval '90 days';
  select count(distinct business_id) filter (where true), count(distinct business_id) filter (where private.is_real(business_id))
  into all_active, real_active from public.events where occurred_at > now() - interval '90 days' and actor_type = 'user';
  select coalesce(sum(amount_usd), 0) * coalesce(real_active::numeric / nullif(all_active, 0), 0) into alloc_usd
  from public.cost_inputs where month > (now() - interval '90 days')::date;
  ue := jsonb_build_object('n', (com ->> 'n')::int, 'revenue_usd_90d', round(rev_usd, 2), 'ai_cost_usd_90d', round(ai_usd, 2), 'allocated_cost_usd_90d', round(alloc_usd, 2),
    'contribution_usd_90d', round(rev_usd - ai_usd - alloc_usd, 2), 'real_active_businesses', real_active,
    'contribution_per_active_business_usd', case when real_active > 0 then round((rev_usd - ai_usd - alloc_usd) / real_active, 2) end,
    'usd_reportable', (fx ->> 'usd_reportable')::boolean,
    'value', case when (fx ->> 'usd_reportable')::boolean and rev_usd > 0 then round((rev_usd - ai_usd - alloc_usd) / rev_usd, 4) end);

  -- Data moat: complete chains decision → intervention → verified outcome in consenting real businesses.
  select jsonb_build_object('n', count(*), 'value', count(*),
      'consenting_real_businesses', (select count(*) from public.businesses where data_class = 'real' and data_sharing = 'network'))
  into moat from public.decisions d join public.outcomes o on o.intervention_id = d.intervention_id join public.businesses b on b.id = d.business_id
  where b.data_class = 'real' and b.data_sharing = 'network' and o.status = 'verified';

  return jsonb_build_object('real_businesses', real_n, 'test_businesses', (select count(*) from public.businesses where data_class = 'test'),
    'environment', private.environment(), 'fx', jsonb_build_object('usd_reportable', fx -> 'usd_reportable'), 'thresholds', t,
    'activation', act, 'outcomes', outc, 'trust', tr, 'commercial', com, 'distribution', dist, 'unit_economics', ue, 'data_moat', moat,
    'register', (select coalesce(jsonb_object_agg(batch, x), '{}') from (select batch, jsonb_object_agg(verification_state, c) x from
                 (select batch, verification_state, count(*) c from public.evidence_register group by 1, 2) y group by 1) z));
end $$;
create or replace function public.real_world_certification() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  e jsonb;
  t jsonb;
  claims jsonb := '[]';
  k text;
  st text;
  statuses text[] := '{}';
  overall text;
  sec jsonb;
  integ jsonb;
  technical text;
begin
  if not private.is_platform_admin() and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
  e := public.real_world_evidence();
  t := e -> 'thresholds';
  foreach k in array array['activation', 'outcomes', 'trust', 'commercial', 'distribution', 'unit_economics', 'data_moat'] loop
    st := private.cert_status((e -> k ->> 'n')::numeric, (e -> k ->> 'value')::numeric, t -> k);
    if k = 'trust' and st = 'PROVEN' and (e -> k ->> 'businesses')::int < (t -> k ->> 'min_businesses')::int then
      st := 'PARTIALLY PROVEN';
    end if;
    if k = 'unit_economics' and not coalesce((e -> k ->> 'usd_reportable')::boolean, false) then
      st := 'INSUFFICIENT EVIDENCE';                               -- never certify money on placeholder or stale FX
    end if;
    statuses := statuses || st;
    claims := claims || jsonb_build_object('claim', k, 'status', st, 'n', e -> k -> 'n', 'value', e -> k -> 'value', 'threshold', t -> k);
  end loop;
  overall := case
    when 'FAILED' = any (statuses) then 'FAILED'
    when statuses <@ array['PROVEN'] then 'PROVEN'
    when statuses <@ array['INSUFFICIENT EVIDENCE'] then 'INSUFFICIENT EVIDENCE'
    else 'PARTIALLY PROVEN' end;
  sec := public.security_report();
  integ := public.integrity_report();
  technical := case when exists (select 1 from jsonb_each(sec) x(sk, sv) where jsonb_typeof(sv) = 'array' and jsonb_array_length(sv) > 0)
                      or exists (select 1 from jsonb_each_text(integ) x(ik, iv) where ik not in ('dead_jobs_7d', 'negative_stock_products') and iv ~ '^\d+$' and iv::int > 0)
                    then 'FAIL' else 'PASS' end;
  return jsonb_build_object('overall', overall, 'technical', technical,
    'note', 'Technical status never changes a real-world claim. Only real businesses (production environment) count.',
    'real_businesses', e -> 'real_businesses', 'test_businesses_excluded', e -> 'test_businesses', 'environment', e -> 'environment',
    'claims', claims, 'evidence', e);
end $$;

-- ─── Grants and RLS ───────────────────────────────────────────────────────────
revoke execute on function public.pilot_dashboard(uuid), public.fx_status_internal(), public.record_pilot_gap(uuid, text, uuid, text, text, text),
  public.update_pilot_gap(text, text, text, text, text), public.market_proof_certification(), public.certify_market_proof() from public, anon;
grant execute on function public.pilot_dashboard(uuid), public.record_pilot_gap(uuid, text, uuid, text, text, text),
  public.update_pilot_gap(text, text, text, text, text), public.market_proof_certification(), public.certify_market_proof() to authenticated, service_role;
revoke execute on function public.fx_status_internal() from authenticated;
grant execute on function public.fx_status_internal() to service_role;

alter table public.pilot_gaps enable row level security;
alter table public.market_proof_certifications enable row level security;
create policy "gaps: pilot viewers" on public.pilot_gaps for select to authenticated using ((pilot_id is not null and private.can_see_pilot(pilot_id)) or private.is_platform_admin());
create policy "market proof: admins" on public.market_proof_certifications for select to authenticated using (private.is_platform_admin());
revoke insert, update, delete on public.pilot_gaps, public.market_proof_certifications from authenticated, anon;
