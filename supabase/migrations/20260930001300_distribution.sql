-- B15 Distribution scale: program builder fields, bulk invitations, acquisition attribution,
-- aggregated sponsor reporting and consent visibility. Reuses B10 programs/consent, B11 outcomes.

alter table public.programs
  add column kind text not null default 'accelerator' check (kind in ('accelerator', 'lender', 'agency', 'supplier', 'other')),
  add column countries text[] not null default '{}',
  add column sectors text[] not null default '{}',
  add column goals text check (char_length(goals) <= 2000),
  add column target_businesses int check (target_businesses between 1 and 1000000);
grant update (kind, countries, sectors, goals, target_businesses) on public.programs to authenticated;

create table public.program_invitations (
  id                      uuid primary key default gen_random_uuid(),
  program_id              uuid not null references public.programs (id) on delete cascade,
  contact                 text not null check (char_length(contact) between 5 and 254),
  status                  text not null default 'invited' check (status in ('invited', 'accepted', 'revoked')),
  invited_by              uuid not null default auth.uid() references public.profiles (id),
  source_partner_user_id  uuid references public.profiles (id),
  business_id             uuid references public.businesses (id) on delete set null,
  invited_at              timestamptz not null default now(),
  accepted_at             timestamptz,
  unique (program_id, contact)
);
create index program_invitations_contact_idx on public.program_invitations (contact) where status = 'invited';

create table public.acquisition_attributions (
  business_id             uuid primary key references public.businesses (id) on delete cascade,
  program_id              uuid references public.programs (id) on delete set null,
  invitation_id           uuid references public.program_invitations (id) on delete set null,
  source_partner_user_id  uuid references public.profiles (id),
  channel                 text not null check (channel in ('partner_invite', 'program_invite', 'program_code', 'organic')),
  attributed_at           timestamptz not null default now()
);

create function private.normalize_contact(c text) returns text language sql immutable as $$
  select case when c like '%@%' then lower(trim(c)) else regexp_replace(c, '[^0-9]', '', 'g') end;
$$;

-- Program admins and program partners invite in bulk; a partner's invites are attributed to them.
create function public.bulk_invite(p_program_id uuid, p_contacts text[]) returns int
language plpgsql security definer set search_path = '' as $$
declare
  role public.program_role;
  n int;
begin
  select m.role into role from public.program_members m where m.program_id = p_program_id and m.user_id = auth.uid();
  if role is null then
    raise exception 'Only program staff can invite' using errcode = '42501';
  end if;
  if cardinality(p_contacts) > 500 then
    raise exception 'At most 500 invitations at a time' using errcode = 'P0001';
  end if;
  insert into public.program_invitations (program_id, contact, source_partner_user_id)
  select p_program_id, c, case when role = 'partner' then auth.uid() end
  from (select distinct private.normalize_contact(x) c from unnest(p_contacts) x) t
  where char_length(c) >= 5
  on conflict (program_id, contact) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

-- Joining (B10) now closes the matching invitation and records first-touch attribution.
create or replace function public.join_program(p_business_id uuid, p_join_code text, p_consent boolean) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  p public.programs;
  active_count int;
  inv public.program_invitations;
begin
  if not private.has_role(p_business_id, array['owner']::public.business_role[]) then
    raise exception 'Only the owner can join a program' using errcode = '42501';
  end if;
  if not coalesce(p_consent, false) then
    raise exception 'Joining needs your consent to share records with the program' using errcode = 'P0001';
  end if;
  select * into p from public.programs where join_code = upper(trim(p_join_code)) and status = 'active';
  if not found then
    raise exception 'No active program uses that code' using errcode = 'P0002';
  end if;
  select count(*) into active_count from public.program_enrollments where program_id = p.id and status = 'active' and business_id <> p_business_id;
  if active_count >= (case when p.subscription_status in ('active', 'trialing') then p.seats else p.pilot_seats end) then
    raise exception 'This program is full. Ask the program team to add seats.' using errcode = 'P0001';
  end if;
  insert into public.program_enrollments (program_id, business_id, status, consent_scope, consented_at, consented_by, enrolled_at, left_at)
  values (p.id, p_business_id, 'active', array['records'], now(), auth.uid(), now(), null)
  on conflict (program_id, business_id) do update
    set status = 'active', consent_scope = array['records'], consented_at = now(), consented_by = auth.uid(), left_at = null;

  -- The owner may have been invited by phone and by email; a partner's invite takes precedence.
  select i.* into inv from public.program_invitations i, auth.users u
  where u.id = auth.uid() and i.program_id = p.id and i.status = 'invited' and i.contact in (lower(u.email), u.phone)
  order by (i.source_partner_user_id is not null) desc, i.invited_at limit 1;
  update public.program_invitations i set status = 'accepted', accepted_at = now(), business_id = p_business_id
  from auth.users u
  where u.id = auth.uid() and i.program_id = p.id and i.status = 'invited' and i.contact in (lower(u.email), u.phone);
  -- First touch, except a business that joins within 30 days of signing up is credited to the program.
  insert into public.acquisition_attributions as a (business_id, program_id, invitation_id, source_partner_user_id, channel)
  values (p_business_id, p.id, inv.id, inv.source_partner_user_id,
          case when inv.source_partner_user_id is not null then 'partner_invite' when inv.id is not null then 'program_invite' else 'program_code' end)
  on conflict (business_id) do update
    set program_id = excluded.program_id, invitation_id = excluded.invitation_id,
        source_partner_user_id = excluded.source_partner_user_id, channel = excluded.channel, attributed_at = now()
    where a.channel = 'organic' and a.attributed_at > now() - interval '30 days';

  perform private.emit_event(p_business_id, 'program.joined', 'program', p.id, jsonb_build_object('name', p.name));
  return p.id;
end $$;

-- Organic attribution for businesses that arrive on their own.
create function private.attribute_organic() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.acquisition_attributions (business_id, channel) values (new.id, 'organic') on conflict do nothing;
  return new;
end $$;
create trigger businesses_attribution after insert on public.businesses for each row execute function private.attribute_organic();

-- Aggregated sponsor report. Small groups (<5) are suppressed so no single business is identifiable.
create function public.program_report(p_program_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  result jsonb;
begin
  if not private.is_program_member(p_program_id, array['admin']::public.program_role[]) then
    raise exception 'Program admins only' using errcode = '42501';
  end if;
  with e as (select business_id, enrolled_at from public.program_enrollments where program_id = p_program_id and status = 'active'),
  latest as (
    select distinct on (s.business_id, s.dimension) s.business_id, s.state from public.pulse_snapshots s
    where s.business_id in (select business_id from e) order by s.business_id, s.dimension, s.computed_on desc
  ),
  ev as (select business_id, type, occurred_at from public.events where business_id in (select business_id from e)),
  inv as (select * from public.program_invitations where program_id = p_program_id),
  o as (select o.* from public.outcomes o where o.business_id in (select business_id from e))
  select jsonb_build_object(
    'enrolled', (select count(*) from e),
    'active_30d', (select count(distinct business_id) from ev where type in ('sale.recorded', 'expense.recorded', 'capture.received') and occurred_at > now() - interval '30 days'),
    'invited', (select count(*) from inv),
    'accepted', (select count(*) from inv where status = 'accepted'),
    'conversion', (select round(count(*) filter (where status = 'accepted')::numeric / nullif(count(*), 0), 3) from inv),
    'by_channel', (select coalesce(jsonb_object_agg(channel, case when n < 5 then '<5' else n::text end), '{}') from (
        select a.channel, count(*) n from public.acquisition_attributions a where a.program_id = p_program_id group by 1) x),
    'activation', jsonb_build_object(
      'first_record', (select count(distinct business_id) from ev where type in ('sale.recorded', 'expense.recorded')),
      'first_plan', (select count(distinct business_id) from ev where type = 'intervention.started'),
      'first_verified_outcome', (select count(distinct business_id) from ev where type = 'outcome.verified')),
    'pulse_states', (select coalesce(jsonb_object_agg(state, n), '{}') from (select state, count(*) n from latest group by 1) x),
    'outcomes', jsonb_build_object(
      'observed', (select count(*) from o), 'improved', (select count(*) from o where improved),
      'verified_improved', (select count(*) from o where improved and status = 'verified')),
    'consent', jsonb_build_object(
      'active', (select count(*) from e),
      'withdrawn', (select count(*) from public.program_enrollments where program_id = p_program_id and status = 'left'))
  ) into result;
  return result;
end $$;

-- What a business owner can see about who sees their data.
create function public.program_access_for_business(p_business_id uuid) returns table (
  program_id uuid, program_name text, sponsor_name text, consented_at timestamptz, admins int, assigned_partners text[]
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.has_role(p_business_id, array['owner', 'staff']::public.business_role[]) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return query
  select p.id, p.name, p.sponsor_name, e.consented_at,
    (select count(*)::int from public.program_members m where m.program_id = p.id and m.role = 'admin'),
    coalesce((select array_agg(coalesce(pr.full_name, 'Partner')) from public.partner_assignments a
              join public.profiles pr on pr.id = a.partner_user_id
              where a.program_id = p.id and a.business_id = p_business_id), '{}')
  from public.program_enrollments e join public.programs p on p.id = e.program_id
  where e.business_id = p_business_id and e.status = 'active';
end $$;

revoke execute on function public.bulk_invite(uuid, text[]), public.program_report(uuid), public.program_access_for_business(uuid) from public, anon;
grant execute on function public.bulk_invite(uuid, text[]), public.program_report(uuid), public.program_access_for_business(uuid) to authenticated;

alter table public.program_invitations enable row level security;
alter table public.acquisition_attributions enable row level security;
create policy "invitations: program staff" on public.program_invitations for select to authenticated
  using (private.is_program_member(program_id, array['admin']::public.program_role[]) or source_partner_user_id = (select auth.uid()));
create policy "attributions: business or program admins" on public.acquisition_attributions for select to authenticated
  using (private.is_member(business_id) or (program_id is not null and private.is_program_member(program_id, array['admin']::public.program_role[])));
revoke insert, update, delete on public.program_invitations, public.acquisition_attributions from authenticated;
