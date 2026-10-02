-- Advance Foundry durable flow state with the existing runtime.

create or replace function public.claim_jobs(p_worker text, p_limit int default 10, p_types text[] default null, p_job_id uuid default null)
returns setof public.jobs
language plpgsql security definer set search_path = '' as $$
declare j public.jobs; fid uuid;
begin
  for j in
    with ready as (
      select id from public.jobs
      where status = 'queued' and run_at <= now()
        and (p_types is null or type = any (p_types))
        and (p_job_id is null or id = p_job_id)
      order by priority, run_at limit greatest(1, least(p_limit, 100))
      for update skip locked
    )
    update public.jobs x
    set status = 'running', locked_at = now(), locked_by = p_worker, attempts = x.attempts + 1
    from ready where x.id = ready.id returning x.*
  loop
    select id into fid from public.foundry_flows where job_id = j.id and stage = 'ready' limit 1;
    if fid is not null then
      perform public.transition_foundry_flow(fid, 'executing', 'job claimed by runtime', j.id, null);
    end if;
    return next j;
  end loop;
end $$;

create or replace function public.complete_job(p_job_id uuid, p_result jsonb default null) returns void
language plpgsql security definer set search_path = '' as $$
declare f public.foundry_flows;
begin
  select * into f from public.foundry_flows where job_id = p_job_id limit 1 for update;
  if f.id is not null and f.evidence_required and p_result is null then
    raise exception 'Foundry flow requires execution evidence before completion' using errcode = '23514';
  end if;

  update public.jobs
  set status = 'succeeded', result = p_result, finished_at = now(), locked_at = null, last_error = null
  where id = p_job_id and status = 'running';

  if f.id is not null then
    if f.evidence_required then
      perform public.transition_foundry_flow(f.id, 'verifying', 'handler returned execution evidence', p_job_id, null);
      perform public.transition_foundry_flow(f.id, 'completed', 'execution evidence accepted by runtime', p_job_id, null);
    else
      perform public.transition_foundry_flow(f.id, 'completed', 'runtime completed', p_job_id, null);
    end if;
  end if;
end $$;
