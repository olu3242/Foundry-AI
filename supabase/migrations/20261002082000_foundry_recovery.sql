-- Foundry Recovery & Resilience OS: reconcile stale/orphaned flow-job state and controlled replay.

create function public.reconcile_foundry_runtime(p_stale_after interval default interval '10 minutes')
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  stale_requeued int := 0;
  flow_failed int := 0;
  orphan_flows int := 0;
  orphan_jobs int := 0;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not private.is_platform_admin() then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;

  -- First let the existing queue recover crashed workers.
  stale_requeued := public.reap_stale_jobs(p_stale_after);

  -- If a flow says executing but its job is back in the queue, return the flow to ready.
  update public.foundry_flows f
  set stage = 'ready', failure_reason = null
  from public.jobs j
  where f.job_id = j.id
    and f.stage = 'executing'
    and j.status = 'queued';
  get diagnostics stale_requeued = stale_requeued + row_count;

  -- Dead jobs are terminal: make sure their flows are closed even if failure happened outside fail_job().
  update public.foundry_flows f
  set stage = 'failed', failed_at = coalesce(f.failed_at, now()),
      failure_reason = coalesce(f.failure_reason, 'linked job is dead')
  from public.jobs j
  where f.job_id = j.id
    and j.status = 'dead'
    and f.stage not in ('completed','failed');
  get diagnostics flow_failed = row_count;

  select count(*) into orphan_flows
  from public.foundry_flows f
  where f.job_id is not null and not exists (select 1 from public.jobs j where j.id = f.job_id);

  select count(*) into orphan_jobs
  from public.jobs j
  where jsonb_typeof(j.payload -> '_foundry_flow') = 'object'
    and not exists (
      select 1 from public.foundry_flows f
      where f.id = nullif(j.payload -> '_foundry_flow' ->> 'flow_id','')::uuid
    );

  return jsonb_build_object(
    'recovered_or_requeued', stale_requeued,
    'flows_failed_from_dead_jobs', flow_failed,
    'orphan_flows', orphan_flows,
    'orphan_jobs', orphan_jobs
  );
end $$;

create function public.replay_foundry_flow(p_flow_id uuid, p_reason text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  f public.foundry_flows;
  j public.jobs;
begin
  if not private.is_platform_admin() then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_reason,''))) < 5 then
    raise exception 'Replay reason required' using errcode = '22023';
  end if;

  select * into f from public.foundry_flows where id = p_flow_id for update;
  if not found or f.stage <> 'failed' or f.job_id is null then
    raise exception 'Only failed flows with a linked job can be replayed' using errcode = 'P0002';
  end if;

  select * into j from public.jobs where id = f.job_id for update;
  if not found or j.status <> 'dead' then
    raise exception 'Linked job must be dead before replay' using errcode = '22023';
  end if;

  perform set_config('app.foundry_flow_reason', 'replay: ' || p_reason, true);
  update public.foundry_flows
  set stage = 'ready', failed_at = null, failure_reason = null
  where id = f.id;

  update public.jobs
  set status = 'queued', attempts = 0, run_at = now(), locked_at = null, locked_by = null,
      last_error = null, finished_at = null
  where id = j.id;

  if f.business_id is not null then
    perform private.emit_event(f.business_id, 'flow.replayed', 'foundry_flow', f.id,
      jsonb_build_object('job_id', j.id, 'reason', p_reason));
  end if;
  return j.id;
end $$;

revoke execute on function public.reconcile_foundry_runtime(interval), public.replay_foundry_flow(uuid,text)
from public, anon;
grant execute on function public.reconcile_foundry_runtime(interval), public.replay_foundry_flow(uuid,text)
to authenticated, service_role;
