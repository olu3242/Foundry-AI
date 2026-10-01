-- B39 Enterprise control: an institution operates many programs — hierarchy, delegated admins,
-- organization-wide sponsorship (B21), organization-scoped policy (B28), aggregated reporting
-- boundaries and SLA telemetry. Business tenant ownership is unchanged: organization roles grant
-- no access to any business; only consented program roles do (B10 can_read is untouched).

create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 3 and 120),
  kind        text not null default 'institution' check (kind in ('bank', 'ngo', 'government', 'corporate', 'institution')),
  sla         jsonb not null default '{"verify_hours": 72, "escalation_hours": 48, "attestation_hours": 120}',
  created_by  uuid not null default auth.uid() references public.profiles (id),
  created_at  timestamptz not null default now()
);
create table public.org_members (
  org_id   uuid not null references public.organizations (id) on delete cascade,
  user_id  uuid not null references public.profiles (id) on delete cascade,
  role     text not null check (role in ('owner', 'admin', 'analyst', 'auditor')),
  primary key (org_id, user_id)
);
create index org_members_user_idx on public.org_members (user_id);
create trigger org_members_audit after insert or update or delete on public.org_members for each row execute function private.audit_row();
alter table public.programs add column organization_id uuid references public.organizations (id) on delete set null;
create index programs_org_idx on public.programs (organization_id);

create function private.org_role(oid uuid) returns text
language sql stable security definer set search_path = '' as $$
  select role from public.org_members where org_id = oid and user_id = (select auth.uid());
$$;

create function public.create_organization(p_name text, p_kind text default 'institution') returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  oid uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  insert into public.organizations (name, kind) values (trim(p_name), p_kind) returning id into oid;
  insert into public.org_members (org_id, user_id, role) values (oid, auth.uid(), 'owner');
  return oid;
end $$;

create function public.add_org_member(p_org_id uuid, p_contact text, p_role text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  target uuid;
  c text := lower(trim(p_contact));
begin
  if coalesce(private.org_role(p_org_id), '') not in ('owner', 'admin') or (p_role = 'owner' and private.org_role(p_org_id) <> 'owner') then
    raise exception 'Organization admins only' using errcode = '42501';
  end if;
  select u.id into target from auth.users u where lower(u.email) = c or u.phone = regexp_replace(c, '[^0-9]', '', 'g') limit 1;
  if target is null then
    raise exception 'No Foundry account uses that phone or email yet' using errcode = 'P0002';
  end if;
  insert into public.org_members (org_id, user_id, role) values (p_org_id, target, p_role) on conflict (org_id, user_id) do update set role = excluded.role;
  return target;
end $$;

-- A program joins an organization only with both sides' admins.
create function public.attach_program(p_org_id uuid, p_program_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(private.org_role(p_org_id), '') not in ('owner', 'admin') or not private.is_program_member(p_program_id, array['admin']::public.program_role[]) then
    raise exception 'You must administer both the organization and the program' using errcode = '42501';
  end if;
  update public.programs set organization_id = p_org_id where id = p_program_id;
end $$;

-- Delegated administration: org admins appoint program admins/partners for the org's programs.
create function public.delegate_program_role(p_org_id uuid, p_program_id uuid, p_contact text, p_role public.program_role) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  target uuid;
  c text := lower(trim(p_contact));
begin
  if coalesce(private.org_role(p_org_id), '') not in ('owner', 'admin')
     or not exists (select 1 from public.programs where id = p_program_id and organization_id = p_org_id) then
    raise exception 'Organization admins only, for the organization''s programs' using errcode = '42501';
  end if;
  select u.id into target from auth.users u where lower(u.email) = c or u.phone = regexp_replace(c, '[^0-9]', '', 'g') limit 1;
  if target is null then
    raise exception 'No Foundry account uses that phone or email yet' using errcode = 'P0002';
  end if;
  insert into public.program_members (program_id, user_id, role) values (p_program_id, target, p_role)
  on conflict (program_id, user_id) do update set role = excluded.role;
  return target;
end $$;

-- Sponsorship shared by program and organization admins (B21 logic, one place).
create function private.apply_sponsorship(p_program_id uuid, p_plan_key text) returns int
language plpgsql security definer set search_path = '' as $$
declare
  pid uuid;
  n int := 0;
  r record;
begin
  if p_plan_key is not null then
    select id into pid from public.billing_plans where key = p_plan_key and payer_kind = 'sponsor' and status = 'active';
    if pid is null then
      raise exception 'That plan can''t be sponsored' using errcode = 'P0001';
    end if;
  end if;
  update public.programs set sponsored_plan_id = pid where id = p_program_id;
  for r in select business_id from public.program_enrollments where program_id = p_program_id and status = 'active' loop
    if pid is null then
      perform private.end_entitlements(r.business_id, 'sponsorship', p_program_id, null, 'sponsorship ended');
    else
      perform private.grant_entitlement(r.business_id, p_plan_key, 'sponsorship', p_program_id);
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function public.sponsor_plan(p_program_id uuid, p_plan_key text) returns int
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_program_member(p_program_id, array['admin']::public.program_role[]) then
    raise exception 'Program admins only' using errcode = '42501';
  end if;
  return private.apply_sponsorship(p_program_id, p_plan_key);
end $$;

create function public.org_sponsor_plan(p_org_id uuid, p_plan_key text) returns int
language plpgsql security definer set search_path = '' as $$
declare
  n int := 0;
  p record;
begin
  if coalesce(private.org_role(p_org_id), '') not in ('owner', 'admin') then
    raise exception 'Organization admins only' using errcode = '42501';
  end if;
  for p in select id from public.programs where organization_id = p_org_id and not is_sandbox loop
    n := n + private.apply_sponsorship(p.id, p_plan_key);
  end loop;
  return n;
end $$;

-- Organization-scoped policy (B28): org admins write policies for their own organization only.
alter table public.policies drop constraint policies_scope_type_check;
alter table public.policies add constraint policies_scope_type_check check (scope_type in ('global', 'market', 'organization', 'program', 'provider', 'solution'));

create or replace function private.policy_context(bid uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('market', b.country_code, 'currency', b.currency,
    'programs', coalesce((select jsonb_agg(program_id::text) from public.program_enrollments where business_id = bid and status = 'active'), '[]'),
    'organizations', coalesce((select jsonb_agg(distinct p.organization_id::text) from public.program_enrollments e join public.programs p on p.id = e.program_id
                               where e.business_id = bid and e.status = 'active' and p.organization_id is not null), '[]'),
    'months_of_records', (select coalesce(extract(month from age(now(), min(occurred_at)))::int + 12 * extract(year from age(now(), min(occurred_at)))::int, 0)
                          from public.sales where business_id = bid and voided_at is null),
    'verified_identifier', exists (select 1 from public.business_identifiers where business_id = bid and verified))
  from public.businesses b where b.id = bid;
$$;

create or replace function private.evaluate_policy(p_key text, ctx jsonb, p_business_id uuid default null, p_record boolean default true) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  p public.policies;
  out jsonb;
  final text := 'allow';
  cap int;
  reasons jsonb := '[]';
  params jsonb := '{}';
  applied jsonb := '[]';
begin
  for p in
    select * from public.policies where key = p_key and status = 'active' and (
      scope_type = 'global'
      or (scope_type = 'market' and scope_id = ctx ->> 'market')
      or (scope_type = 'program' and ctx -> 'programs' @> jsonb_build_array(scope_id))
      or (scope_type = 'organization' and ctx -> 'organizations' @> jsonb_build_array(scope_id))
      or (scope_type = 'provider' and scope_id = ctx ->> 'provider_id')
      or (scope_type = 'solution' and scope_id = ctx ->> 'solution_id'))
    order by array_position(array['global', 'market', 'organization', 'program', 'provider', 'solution'], scope_type)
  loop
    out := private.policy_apply(p.definition, ctx);
    params := params || coalesce(p.definition -> 'params', '{}');   -- more specific scopes override
    applied := applied || jsonb_build_object('policy_id', p.id, 'scope', p.scope_type || ':' || p.scope_id, 'version', p.version, 'result', out ->> 'result');
    if out ->> 'result' = 'deny' then
      final := 'deny';
    elsif out ->> 'result' like 'cap:%' and final <> 'deny' then
      cap := least(coalesce(cap, 5), split_part(out ->> 'result', ':', 2)::int);
      final := 'cap:' || cap;
    end if;
    if out ->> 'reason' is not null then
      reasons := reasons || to_jsonb(out ->> 'reason');
    end if;
    if p_record then
      insert into public.policy_decisions (policy_id, policy_key, version, scope, business_id, input, result, reason)
      values (p.id, p.key, p.version, p.scope_type || ':' || p.scope_id, p_business_id, ctx, out ->> 'result', out ->> 'reason');
    end if;
  end loop;
  return jsonb_build_object('result', final, 'reasons', reasons, 'params', params, 'applied', applied);
end $$;

create function public.save_org_policy(p_org_id uuid, p_key text, p_definition jsonb, p_note text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v int;
  pid uuid;
begin
  if coalesce(private.org_role(p_org_id), '') not in ('owner', 'admin') then
    raise exception 'Organization admins only' using errcode = '42501';
  end if;
  if exists (select 1 from jsonb_array_elements(coalesce(p_definition -> 'rules', '[]')) r where (r ->> 'then') !~ '^(allow|deny|cap:[0-5])$') then
    raise exception 'Rules need "then": allow, deny or cap:0–5' using errcode = '22023';
  end if;
  select coalesce(max(version), 0) + 1 into v from public.policies where key = p_key and scope_type = 'organization' and scope_id = p_org_id::text;
  update public.policies set status = 'retired' where key = p_key and scope_type = 'organization' and scope_id = p_org_id::text and status = 'active';
  insert into public.policies (key, scope_type, scope_id, version, definition, note, status, activated_at)
  values (p_key, 'organization', p_org_id::text, v, p_definition, p_note, 'active', now()) returning id into pid;
  return pid;
end $$;

-- Reporting boundary: aggregated across the organization's programs; never business rows.
create function public.org_report(p_org_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  o public.organizations;
begin
  if private.org_role(p_org_id) is null then
    raise exception 'Organization members only' using errcode = '42501';
  end if;
  select * into o from public.organizations where id = p_org_id;
  return jsonb_build_object(
    'organization', jsonb_build_object('id', o.id, 'name', o.name, 'sla', o.sla),
    'programs', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'sandbox', p.is_sandbox,
        'report', private.program_report_body(p.id),
        'sla', jsonb_build_object(
          'verify_hours_median', (select round((percentile_cont(0.5) within group (order by extract(epoch from o2.verified_at - o2.measured_at) / 3600))::numeric, 1)
             from public.outcomes o2 join public.program_enrollments e on e.business_id = o2.business_id and e.program_id = p.id where o2.verified_at is not null),
          'verify_breaches', (select count(*) from public.outcomes o2 join public.program_enrollments e on e.business_id = o2.business_id and e.program_id = p.id
             where o2.status = 'observed' and o2.measured_at < now() - make_interval(hours => (o.sla ->> 'verify_hours')::int)),
          'escalation_hours_median', (select round((percentile_cont(0.5) within group (order by extract(epoch from x.resolved_at - x.created_at) / 3600))::numeric, 1)
             from public.escalations x where x.program_id = p.id and x.resolved_at is not null),
          'escalation_breaches', (select count(*) from public.escalations x where x.program_id = p.id and x.status = 'open'
             and x.created_at < now() - make_interval(hours => (o.sla ->> 'escalation_hours')::int))))
      order by p.name), '[]') from public.programs p where p.organization_id = p_org_id),
    'totals', (select jsonb_build_object('programs', count(*), 'enrolled', coalesce(sum((select count(*) from public.program_enrollments e where e.program_id = p.id and e.status = 'active')), 0))
               from public.programs p where p.organization_id = p_org_id and not p.is_sandbox),
    'boundary', 'Aggregates only. Business-level data stays with each business and the programs it consented to.');
end $$;

create function public.set_org_sla(p_org_id uuid, p_sla jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(private.org_role(p_org_id), '') not in ('owner', 'admin') then
    raise exception 'Organization admins only' using errcode = '42501';
  end if;
  update public.organizations set sla = sla || p_sla where id = p_org_id;
end $$;

revoke execute on function public.create_organization(text, text), public.add_org_member(uuid, text, text), public.attach_program(uuid, uuid),
  public.delegate_program_role(uuid, uuid, text, public.program_role), public.org_sponsor_plan(uuid, text), public.save_org_policy(uuid, text, jsonb, text),
  public.org_report(uuid), public.set_org_sla(uuid, jsonb) from public, anon;
grant execute on function public.create_organization(text, text), public.add_org_member(uuid, text, text), public.attach_program(uuid, uuid),
  public.delegate_program_role(uuid, uuid, text, public.program_role), public.org_sponsor_plan(uuid, text), public.save_org_policy(uuid, text, jsonb, text),
  public.org_report(uuid), public.set_org_sla(uuid, jsonb) to authenticated;

alter table public.organizations enable row level security;
alter table public.org_members enable row level security;
create policy "orgs: members" on public.organizations for select to authenticated using (private.org_role(id) is not null or private.is_platform_admin());
create policy "org members: members" on public.org_members for select to authenticated using (private.org_role(org_id) is not null);
revoke insert, update, delete on public.organizations, public.org_members from authenticated;
