-- B30 Scale OS: one operational control plane over B1–B29 telemetry — growth, operators, partners,
-- solutions, interventions, outcomes, data quality, AI/infrastructure cost, economics, incidents and
-- policy violations — with status per area and the interventions leadership needs to make.
-- Incidents are detected from real signals and auto-resolve when the signal clears.

create table public.incidents (
  id           uuid primary key default gen_random_uuid(),
  fingerprint  text not null,
  source       text not null check (source in ('jobs', 'webhooks', 'integrity', 'security', 'drift', 'policy', 'experiments', 'billing')),
  severity     text not null check (severity in ('critical', 'high', 'medium', 'low')),
  title        text not null,
  detail       jsonb not null default '{}',
  status       text not null default 'open' check (status in ('open', 'acknowledged', 'resolved')),
  opened_at    timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_at  timestamptz,
  acknowledged_by uuid references public.profiles (id)
);
create unique index incidents_open_fingerprint on public.incidents (fingerprint) where status <> 'resolved';
create index incidents_opened_idx on public.incidents (opened_at desc);
create trigger incidents_audit after insert or update of status on public.incidents for each row execute function private.audit_row();

-- Current signals → incidents (upsert by fingerprint; missing signals resolve).
create function public.detect_incidents() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  sig record;
  opened int := 0;
  resolved int;
  seen text[] := '{}';
  integ jsonb;
  sec jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not private.is_platform_admin() then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
  integ := public.integrity_report();
  sec := public.security_report();
  for sig in
    select 'jobs:dead:' || type fp, 'jobs' src, case when count(*) >= 10 then 'high' else 'medium' end sev,
      count(*) || ' ' || type || ' job(s) dead-lettered in 24h' title, jsonb_build_object('type', type, 'count', count(*), 'last_error', max(last_error)) det
    from public.jobs where status = 'dead' and updated_at > now() - interval '24 hours' group by type
    union all
    select 'webhooks:failed:' || program_id, 'webhooks', 'medium', count(*) || ' webhook deliveries failed', jsonb_build_object('program_id', program_id, 'count', count(*))
    from public.webhook_deliveries d join public.webhook_subscriptions w on w.id = d.subscription_id
    where d.status = 'failed' and d.created_at > now() - interval '24 hours' group by program_id
    union all
    select 'integrity:' || k, 'integrity', 'high', 'Data integrity check failing: ' || k, jsonb_build_object('check', k, 'count', v)
    from jsonb_each_text(integ) x(k, v) where k not in ('dead_jobs_7d', 'negative_stock_products') and v ~ '^\d+$' and v::int > 0
    union all
    select 'security:' || k, 'security', 'critical', 'Security check failing: ' || k, jsonb_build_object('check', k, 'items', v)
    from jsonb_each(sec) x(k, v) where jsonb_typeof(v) = 'array' and jsonb_array_length(v) > 0
    union all
    select 'drift:' || scope || ':' || subject, 'drift', 'medium', 'Model/metric drift: ' || scope || ' · ' || subject, jsonb_build_object('scope', scope, 'subject', subject)
    from public.eval_snapshots where drift and taken_on > current_date - 7
    union all
    select 'policy:denials:' || policy_key, 'policy', 'low', count(*) || ' ' || policy_key || ' denials in 24h', jsonb_build_object('policy', policy_key, 'count', count(*))
    from public.policy_decisions where result = 'deny' and decided_at > now() - interval '24 hours' group by policy_key having count(*) >= 20
    union all
    select 'experiments:guardrail:' || id, 'experiments', 'medium', 'Experiment stopped by guardrail: ' || name, jsonb_build_object('experiment_id', id, 'conclusion', conclusion)
    from public.experiments where status = 'stopped' and conclusion like 'Stopped automatically%' and ended_at > now() - interval '7 days'
    union all
    select 'billing:overdue', 'billing', 'medium', count(*) || ' charges open for 30+ days', jsonb_build_object('count', count(*), 'amount_usd', round(sum(private.to_usd(amount_minor, currency)), 2))
    from public.billable_events where status = 'open' and created_at < now() - interval '30 days' having count(*) > 0
  loop
    seen := seen || sig.fp;
    insert into public.incidents (fingerprint, source, severity, title, detail)
    values (sig.fp, sig.src, sig.sev, sig.title, sig.det)
    on conflict (fingerprint) where status <> 'resolved' do update set last_seen_at = now(), title = excluded.title, detail = excluded.detail, severity = excluded.severity;
  end loop;
  get diagnostics opened = row_count;
  update public.incidents set status = 'resolved', resolved_at = now() where status <> 'resolved' and not (fingerprint = any (seen));
  get diagnostics resolved = row_count;
  return jsonb_build_object('active', cardinality(seen), 'resolved', resolved);
end $$;

create function public.acknowledge_incident(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_platform_admin() then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
  update public.incidents set status = 'acknowledged', acknowledged_by = auth.uid() where id = p_id and status = 'open';
end $$;

-- One view for leadership. Each area: key numbers, a status and why.
create function public.control_plane(p_days int default 30) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  m jsonb;
  r jsonb;
  from_at timestamptz := now() - make_interval(days => p_days);
  areas jsonb;
  actions jsonb := '[]';
  n int;
  x numeric;
begin
  if not private.is_platform_admin() then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
  m := public.scale_metrics(from_at, now());
  r := public.retention_overview();

  areas := jsonb_build_object(
    'growth', jsonb_build_object('businesses', m -> 'product' -> 'businesses_total', 'new', m -> 'product' -> 'businesses_created',
      'active', m -> 'product' -> 'active_businesses', 'activated_7d', m -> 'product' -> 'activated_within_7d', 'by_channel', m -> 'distribution' -> 'by_channel'),
    'retention', jsonb_build_object('risk', r -> 'risk', 'continuation', r -> 'continuation', 'recovery', r -> 'recovery'),
    'operators', m -> 'operations',
    'partners', jsonb_build_object(
      'providers_approved', (select count(*) from public.providers where status = 'approved'),
      'providers_pending', (select count(*) from public.providers where status = 'pending'),
      'verifiers_approved', (select count(*) from public.verifiers where status = 'approved'),
      'verifiers_pending', (select count(*) from public.verifiers where status = 'pending'),
      'open_disputes', (select count(*) from public.attestation_disputes where status = 'open'),
      'open_escalations', (select count(*) from public.escalations where status = 'open'),
      'api_calls', (select count(*) from public.integration_calls where at > from_at),
      'api_error_rate', (select round(count(*) filter (where status >= 500)::numeric / nullif(count(*), 0), 3) from public.integration_calls where at > from_at)),
    'solutions', jsonb_build_object('funnel', m -> 'solutions',
      'running_experiments', (select count(*) from public.experiments where status = 'running')),
    'outcomes', jsonb_build_object('impact_usd', m -> 'impact_usd', 'verified_outcome_rate', m -> 'solutions' -> 'verified_outcome_rate'),
    'data_quality', jsonb_build_object(
      'open_issues', (select coalesce(jsonb_object_agg(kind, c), '{}') from (select kind, count(*) c from public.data_quality_issues where status = 'open' group by kind) q),
      'records_verified_share', round((m -> 'product' ->> 'records_verified')::numeric / nullif((m -> 'product' ->> 'records_created')::numeric, 0), 3),
      'attestations_active', (select count(*) from public.attestations where status = 'active')),
    'automation', public.automation_overview(p_days),
    'economics', m -> 'economics_usd',
    'incidents', jsonb_build_object(
      'open', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'severity', severity, 'title', title, 'source', source, 'since', opened_at, 'status', status)
                 order by array_position(array['critical', 'high', 'medium', 'low'], severity), opened_at), '[]') from public.incidents where status <> 'resolved'),
      'resolved_period', (select count(*) from public.incidents where status = 'resolved' and resolved_at > from_at)),
    'policy', jsonb_build_object(
      'decisions', (select count(*) from public.policy_decisions where decided_at > from_at),
      'denials', (select count(*) from public.policy_decisions where decided_at > from_at and result = 'deny'),
      'by_policy', (select coalesce(jsonb_object_agg(policy_key, c), '{}') from (select policy_key, count(*) filter (where result = 'deny') c
                   from public.policy_decisions where decided_at > from_at group by policy_key) p)));

  -- Required interventions, most urgent first.
  select count(*) into n from public.incidents where status = 'open' and severity in ('critical', 'high');
  if n > 0 then actions := actions || jsonb_build_object('area', 'incidents', 'priority', 1, 'action', n || ' critical/high incident(s) open', 'link', '/admin/control'); end if;
  n := coalesce((r -> 'risk' ->> 'at_risk')::int, 0) + coalesce((r -> 'risk' ->> 'dormant')::int, 0);
  if n > 0 then actions := actions || jsonb_build_object('area', 'retention', 'priority', 2, 'action', n || ' business(es) at risk or dormant', 'link', '/admin/retention'); end if;
  select count(*) into n from public.attestation_disputes where status = 'open';
  if n > 0 then actions := actions || jsonb_build_object('area', 'partners', 'priority', 2, 'action', n || ' verification dispute(s) to resolve', 'link', '/admin/trust'); end if;
  select count(*) into n from public.verifiers where status = 'pending';
  if n > 0 then actions := actions || jsonb_build_object('area', 'partners', 'priority', 3, 'action', n || ' verifier(s) awaiting approval', 'link', '/admin/trust'); end if;
  select count(*) into n from public.solutions where status = 'submitted';
  if n > 0 then actions := actions || jsonb_build_object('area', 'solutions', 'priority', 3, 'action', n || ' solution(s) awaiting review', 'link', '/admin/solutions'); end if;
  select count(*) into n from public.billable_events where status = 'open' and created_at < now() - interval '30 days';
  if n > 0 then actions := actions || jsonb_build_object('area', 'economics', 'priority', 2, 'action', n || ' charge(s) unpaid for 30+ days', 'link', '/admin/commercial'); end if;
  x := (m -> 'economics_usd' ->> 'gross_contribution')::numeric;
  if x < 0 then actions := actions || jsonb_build_object('area', 'economics', 'priority', 2, 'action', 'Gross contribution is negative ($' || x || ')', 'link', '/admin/scale'); end if;
  select count(*) into n from public.data_quality_issues where status = 'open' and kind in ('duplicate', 'conflict') and detected_at < now() - interval '14 days';
  if n > 0 then actions := actions || jsonb_build_object('area', 'data_quality', 'priority', 3, 'action', n || ' duplicate/conflict issue(s) unresolved for 14+ days', 'link', '/admin/control'); end if;

  return jsonb_build_object('period_days', p_days, 'generated_at', now(), 'areas', areas,
    'status', jsonb_build_object(
      'incidents', case when exists (select 1 from public.incidents where status <> 'resolved' and severity in ('critical', 'high')) then 'red'
                        when exists (select 1 from public.incidents where status <> 'resolved') then 'amber' else 'green' end,
      'economics', case when x < 0 then 'red' when x is null or x = 0 then 'amber' else 'green' end,
      'retention', case when coalesce((r -> 'risk' ->> 'dormant')::int, 0) > coalesce((r -> 'risk' ->> 'healthy')::int, 0) then 'red'
                        when coalesce((r -> 'risk' ->> 'at_risk')::int, 0) > 0 then 'amber' else 'green' end,
      'outcomes', case when coalesce((m -> 'solutions' ->> 'verified_outcomes')::int, 0) = 0 then 'amber' else 'green' end,
      'partners', case when (areas -> 'partners' ->> 'open_disputes')::int > 0 then 'amber' else 'green' end),
    'required_interventions', (select coalesce(jsonb_agg(a order by (a ->> 'priority')::int), '[]') from jsonb_array_elements(actions) a));
end $$;

revoke execute on function public.detect_incidents(), public.acknowledge_incident(uuid), public.control_plane(int) from public, anon;
grant execute on function public.detect_incidents(), public.acknowledge_incident(uuid), public.control_plane(int) to authenticated;

alter table public.incidents enable row level security;
create policy "incidents: admins" on public.incidents for select to authenticated using (private.is_platform_admin());
revoke insert, update, delete on public.incidents from authenticated;
