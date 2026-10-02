-- Terminal job failure closes its durable Foundry flow; retryable failures do not.

create or replace function public.fail_job(p_job_id uuid, p_error text, p_retryable boolean default true)
returns public.job_status
language plpgsql security definer set search_path = '' as $$
declare
  j public.jobs;
  next_status public.job_status;
  fid uuid;
begin
  select * into j from public.jobs where id = p_job_id and status = 'running' for update;
  if not found then return null; end if;

  next_status := case
    when p_retryable and j.attempts < j.max_attempts then 'queued'::public.job_status
    else 'dead'::public.job_status
  end;

  update public.jobs
  set status = next_status, last_error = left(p_error, 2000), locked_at = null, locked_by = null,
      run_at = case when next_status = 'queued'
        then now() + least(interval '1 hour', interval '15 seconds' * power(2, j.attempts - 1)) * (1 + random() * 0.2)
        else run_at end,
      finished_at = case when next_status = 'dead' then now() end
  where id = p_job_id;

  select id into fid from public.foundry_flows where job_id = p_job_id limit 1;
  if fid is not null and next_status = 'dead' then
    perform public.transition_foundry_flow(fid, 'failed', 'job dead-lettered', p_job_id, left(p_error, 2000));
  end if;

  if next_status = 'dead' and j.business_id is not null then
    perform private.emit_event(j.business_id, 'job.dead', 'job', j.id,
      jsonb_build_object('type', j.type, 'error', left(p_error, 300)), 'system');
  end if;
  return next_status;
end $$;
