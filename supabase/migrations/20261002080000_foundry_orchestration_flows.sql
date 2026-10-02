-- Foundry Orchestration Kernel: durable flow state + append-only transitions + HIL approval.
-- Jobs remain the execution engine; flows provide durable cross-engine identity and authority state.

create table public.foundry_flows (
  id                uuid primary key,
  business_id       uuid references public.businesses (id) on delete cascade,
  flow_type         text not null check (flow_type ~ '^[a-z_]+(\.[a-z_]+)+$'),
  correlation_id    uuid not null,
  stage             text not null check (stage in (
    'triggered','context_loaded','decided','policy_checked','awaiting_approval',
    'ready','executing','verifying','completed','failed'
  )),
  authority_mode    text not null check (authority_mode in ('auto','hil','operator','blocked')),
  approval_required boolean not null default false,
  capability        jsonb,
  evidence_required boolean not null default true,
  triggered_by      text not null,
  decision_id       uuid references public.decisions (id) on delete set null,
  intervention_id   uuid references public.interventions (id) on delete set null,
  job_id            uuid references public.jobs (id) on delete set null,
  metadata          jsonb not null default '{}',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  approved_at       timestamptz,
  approved_by       uuid references public.profiles (id),
  completed_at      timestamptz,
  failed_at         timestamptz,
  failure_reason    text
);
create index foundry_flows_business_idx on public.foundry_flows (business_id, created_at desc);
create index foundry_flows_correlation_idx on public.foundry_flows (correlation_id);
create index foundry_flows_job_idx on public.foundry_flows (job_id) where job_id is not null;
create index foundry_flows_pending_approval_idx on public.foundry_flows (business_id, created_at desc)
  where stage = 'awaiting_approval';

create table public.foundry_flow_transitions (
  id             bigint generated always as identity primary key,
  flow_id        uuid not null references public.foundry_flows (id) on delete cascade,
  business_id    uuid references public.businesses (id) on delete cascade,
  from_stage     text,
  to_stage       text not null,
  authority_mode text not null,
  actor_id       uuid references public.profiles (id),
  actor_type     public.actor_type not null default 'system',
  reason         text,
  detail         jsonb not null default '{}',
  occurred_at    timestamptz not null default now()
);
create index foundry_flow_transitions_flow_idx on public.foundry_flow_transitions (flow_id, occurred_at);
create index foundry_flow_transitions_business_idx on public.foundry_flow_transitions (business_id, occurred_at desc);

create function private.foundry_flow_transition_allowed(p_from text, p_to text) returns boolean
language sql immutable set search_path = '' as $$
  select case
    when p_from is null then p_to = 'triggered'
    when p_from = p_to then true
    when p_from = 'triggered' then p_to in ('context_loaded','policy_checked','awaiting_approval','ready','failed')
    when p_from = 'context_loaded' then p_to in ('decided','policy_checked','awaiting_approval','ready','failed')
    when p_from = 'decided' then p_to in ('policy_checked','awaiting_approval','ready','failed')
    when p_from = 'policy_checked' then p_to in ('awaiting_approval','ready','failed')
    when p_from = 'awaiting_approval' then p_to in ('ready','failed')
    when p_from = 'ready' then p_to in ('executing','failed')
    when p_from = 'executing' then p_to in ('verifying','completed','failed')
    when p_from = 'verifying' then p_to in ('completed','failed')
    else false
  end;
$$;

create function private.foundry_flow_audit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  reason text := nullif(current_setting('app.foundry_flow_reason', true), '');
begin
  if tg_op = 'INSERT' then
    insert into public.foundry_flow_transitions
      (flow_id, business_id, from_stage, to_stage, authority_mode, actor_id, actor_type, reason)
    values
      (new.id, new.business_id, null, new.stage, new.authority_mode, auth.uid(),
       case when auth.uid() is null then 'system' else 'user' end::public.actor_type, reason);
    return new;
  end if;

  if old.stage <> new.stage then
    if not private.foundry_flow_transition_allowed(old.stage, new.stage) then
      raise exception 'Invalid Foundry flow transition: % -> %', old.stage, new.stage using errcode = '22023';
    end if;
    insert into public.foundry_flow_transitions
      (flow_id, business_id, from_stage, to_stage, authority_mode, actor_id, actor_type, reason,
       detail)
    values
      (new.id, new.business_id, old.stage, new.stage, new.authority_mode, auth.uid(),
       case when auth.uid() is null then 'system' else 'user' end::public.actor_type, reason,
       jsonb_build_object('approval_required', new.approval_required, 'job_id', new.job_id));
  end if;
  return new;
end $$;

create trigger foundry_flows_touch before update on public.foundry_flows
for each row execute function private.touch_updated_at();

create trigger foundry_flows_audit after insert or update of stage on public.foundry_flows
for each row execute function private.foundry_flow_audit();

create function public.create_foundry_flow(
  p_id uuid,
  p_business_id uuid,
  p_flow_type text,
  p_correlation_id uuid,
  p_stage text,
  p_authority_mode text,
  p_approval_required boolean,
  p_capability jsonb,
  p_evidence_required boolean,
  p_triggered_by text,
  p_decision_id uuid default null,
  p_intervention_id uuid default null,
  p_metadata jsonb default '{}'
) returns uuid
language plpgsql security definer set search_path = '' as $$
begin
  if p_business_id is not null and not (private.can_write(p_business_id) or coalesce(auth.role(), '') = 'service_role') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if not private.foundry_flow_transition_allowed(null, p_stage) and p_stage <> 'ready' and p_stage <> 'awaiting_approval' then
    raise exception 'Invalid initial Foundry flow stage' using errcode = '22023';
  end if;
  insert into public.foundry_flows
    (id, business_id, flow_type, correlation_id, stage, authority_mode, approval_required,
     capability, evidence_required, triggered_by, decision_id, intervention_id, metadata)
  values
    (p_id, p_business_id, p_flow_type, p_correlation_id, p_stage, p_authority_mode,
     p_approval_required, p_capability, p_evidence_required, p_triggered_by,
     p_decision_id, p_intervention_id, coalesce(p_metadata, '{}'))
  on conflict (id) do nothing;
  return p_id;
end $$;

create function public.transition_foundry_flow(
  p_flow_id uuid,
  p_to_stage text,
  p_reason text default null,
  p_job_id uuid default null,
  p_failure_reason text default null
) returns public.foundry_flows
language plpgsql security definer set search_path = '' as $$
declare
  f public.foundry_flows;
begin
  select * into f from public.foundry_flows where id = p_flow_id for update;
  if not found then raise exception 'Flow not found' using errcode = 'P0002'; end if;
  if f.business_id is not null and not (private.can_write(f.business_id) or coalesce(auth.role(), '') = 'service_role') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if not private.foundry_flow_transition_allowed(f.stage, p_to_stage) then
    raise exception 'Invalid Foundry flow transition' using errcode = '22023';
  end if;
  perform set_config('app.foundry_flow_reason', coalesce(p_reason, ''), true);
  update public.foundry_flows
  set stage = p_to_stage,
      job_id = coalesce(p_job_id, job_id),
      completed_at = case when p_to_stage = 'completed' then now() else completed_at end,
      failed_at = case when p_to_stage = 'failed' then now() else failed_at end,
      failure_reason = case when p_to_stage = 'failed' then p_failure_reason else failure_reason end
  where id = p_flow_id
  returning * into f;
  return f;
end $$;

create function public.approve_foundry_flow(p_flow_id uuid, p_reason text default null)
returns public.foundry_flows
language plpgsql security definer set search_path = '' as $$
declare
  f public.foundry_flows;
begin
  select * into f from public.foundry_flows where id = p_flow_id for update;
  if not found then raise exception 'Flow not found' using errcode = 'P0002'; end if;
  if f.business_id is null or not private.can_write(f.business_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if f.stage <> 'awaiting_approval' or not f.approval_required then
    raise exception 'Flow is not awaiting approval' using errcode = '22023';
  end if;
  if f.authority_mode = 'blocked' then
    raise exception 'Blocked flow cannot be approved' using errcode = '22023';
  end if;
  perform set_config('app.foundry_flow_reason', coalesce(p_reason, 'approved'), true);
  update public.foundry_flows
  set stage = 'ready', approval_required = false, approved_at = now(), approved_by = auth.uid()
  where id = p_flow_id
  returning * into f;
  perform private.emit_event(f.business_id, 'flow.approved', 'foundry_flow', f.id,
    jsonb_build_object('flow_type', f.flow_type, 'correlation_id', f.correlation_id));
  return f;
end $$;

alter table public.foundry_flows enable row level security;
alter table public.foundry_flow_transitions enable row level security;

create policy "foundry flows: readers" on public.foundry_flows for select to authenticated
using (business_id is not null and private.can_read(business_id));

create policy "foundry transitions: readers" on public.foundry_flow_transitions for select to authenticated
using (business_id is not null and private.can_read(business_id));

grant select on public.foundry_flows, public.foundry_flow_transitions to authenticated;
revoke insert, update, delete on public.foundry_flows, public.foundry_flow_transitions from authenticated;

revoke execute on function public.create_foundry_flow(uuid, uuid, text, uuid, text, text, boolean, jsonb, boolean, text, uuid, uuid, jsonb),
  public.transition_foundry_flow(uuid, text, text, uuid, text),
  public.approve_foundry_flow(uuid, text)
from public, anon;

grant execute on function public.create_foundry_flow(uuid, uuid, text, uuid, text, text, boolean, jsonb, boolean, text, uuid, uuid, jsonb),
  public.transition_foundry_flow(uuid, text, text, uuid, text)
to service_role;

grant execute on function public.approve_foundry_flow(uuid, text) to authenticated;
