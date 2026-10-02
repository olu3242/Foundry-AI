-- Surface orchestration/runtime inconsistencies in the existing control-plane incident detector.
create function public.detect_foundry_runtime_incidents() returns int
language plpgsql security definer set search_path = '' as $$
declare n int := 0;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not private.is_platform_admin() then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.foundry_flows f
    where f.stage in ('executing','verifying') and f.updated_at < now() - interval '15 minutes'
  ) then
    insert into public.incidents (fingerprint,source,severity,title,detail)
    values ('foundry:stale-flows','jobs','high','Foundry flows are stale in execution',
      jsonb_build_object('count',(select count(*) from public.foundry_flows where stage in ('executing','verifying') and updated_at < now() - interval '15 minutes')))
    on conflict (fingerprint) where status <> 'resolved'
    do update set last_seen_at=now(), detail=excluded.detail, severity=excluded.severity;
    n := n + 1;
  else
    update public.incidents set status='resolved',resolved_at=now()
    where fingerprint='foundry:stale-flows' and status <> 'resolved';
  end if;

  if exists (
    select 1 from public.jobs j
    where jsonb_typeof(j.payload -> '_foundry_flow')='object'
      and not exists (select 1 from public.foundry_flows f where f.id=nullif(j.payload -> '_foundry_flow' ->> 'flow_id','')::uuid)
  ) then
    insert into public.incidents (fingerprint,source,severity,title,detail)
    values ('foundry:orphan-jobs','integrity','high','Foundry jobs are missing durable flow state',
      jsonb_build_object('count',(select count(*) from public.jobs j where jsonb_typeof(j.payload -> '_foundry_flow')='object'
        and not exists (select 1 from public.foundry_flows f where f.id=nullif(j.payload -> '_foundry_flow' ->> 'flow_id','')::uuid))))
    on conflict (fingerprint) where status <> 'resolved'
    do update set last_seen_at=now(), detail=excluded.detail, severity=excluded.severity;
    n := n + 1;
  else
    update public.incidents set status='resolved',resolved_at=now()
    where fingerprint='foundry:orphan-jobs' and status <> 'resolved';
  end if;
  return n;
end $$;

revoke execute on function public.detect_foundry_runtime_incidents() from public,anon;
grant execute on function public.detect_foundry_runtime_incidents() to authenticated,service_role;
