-- Bind Foundry flow envelopes to durable flow rows when jobs are enqueued.

create function private.sync_foundry_flow_from_job(p_job_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  j public.jobs;
  f jsonb;
  fid uuid;
begin
  select * into j from public.jobs where id = p_job_id;
  if not found or jsonb_typeof(j.payload -> '_foundry_flow') <> 'object' then return; end if;
  f := j.payload -> '_foundry_flow';
  fid := nullif(f ->> 'flow_id', '')::uuid;
  if fid is null then return; end if;

  insert into public.foundry_flows (
    id, business_id, flow_type, correlation_id, stage, authority_mode, approval_required,
    capability, evidence_required, triggered_by, decision_id, intervention_id, job_id, metadata, created_at
  ) values (
    fid, j.business_id, f ->> 'flow_type', (f ->> 'correlation_id')::uuid, f ->> 'stage',
    f ->> 'authority_mode', coalesce((f ->> 'approval_required')::boolean, false),
    f -> 'capability', coalesce((f ->> 'evidence_required')::boolean, true), f ->> 'triggered_by',
    nullif(f ->> 'decision_id', '')::uuid, nullif(f ->> 'intervention_id', '')::uuid,
    j.id, coalesce(f -> 'metadata', '{}'), coalesce((f ->> 'created_at')::timestamptz, now())
  )
  on conflict (id) do update set
    job_id = excluded.job_id,
    business_id = coalesce(public.foundry_flows.business_id, excluded.business_id),
    decision_id = coalesce(public.foundry_flows.decision_id, excluded.decision_id),
    intervention_id = coalesce(public.foundry_flows.intervention_id, excluded.intervention_id);
end $$;

create or replace function private.enqueue_job(
  p_type text, p_business_id uuid default null, p_payload jsonb default '{}',
  p_dedupe_key text default null, p_run_at timestamptz default now(),
  p_max_attempts int default 5, p_priority smallint default 100
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare job_id uuid;
begin
  insert into public.jobs (type, business_id, payload, dedupe_key, run_at, max_attempts, priority)
  values (p_type, p_business_id, coalesce(p_payload, '{}'), p_dedupe_key, coalesce(p_run_at, now()), p_max_attempts, p_priority)
  on conflict (dedupe_key) where dedupe_key is not null and status in ('queued', 'running') do nothing
  returning id into job_id;
  if job_id is null then
    select id into job_id from public.jobs where dedupe_key = p_dedupe_key and status in ('queued', 'running') limit 1;
  end if;
  perform private.sync_foundry_flow_from_job(job_id);
  return job_id;
end $$;

revoke execute on function private.sync_foundry_flow_from_job(uuid) from public, anon, authenticated;
