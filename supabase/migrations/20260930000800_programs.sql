-- Batch 10: Programs (sponsors, banks, agencies), human business partners, consent-based access,
-- and Stripe billing for program seats.

create type public.program_role as enum ('admin', 'partner');

create table public.programs (
  id                      uuid primary key default gen_random_uuid(),
  name                    text not null check (char_length(name) between 3 and 120),
  sponsor_name            text check (char_length(sponsor_name) <= 120),
  description             text check (char_length(description) <= 2000),
  join_code               text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  status                  text not null default 'active' check (status in ('active', 'paused', 'closed')),
  seats                   int not null default 25 check (seats between 1 and 10000),
  pilot_seats             int not null default 5,
  stripe_customer_id      text,
  stripe_subscription_id  text unique,
  subscription_status     text,
  current_period_end      timestamptz,
  created_by              uuid not null default auth.uid() references public.profiles (id),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create trigger programs_touch before update on public.programs for each row execute function private.touch_updated_at();

create table public.program_members (
  program_id  uuid not null references public.programs (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  role        public.program_role not null,
  created_at  timestamptz not null default now(),
  primary key (program_id, user_id)
);
create index program_members_user_idx on public.program_members (user_id);

create table public.program_enrollments (
  program_id     uuid not null references public.programs (id) on delete cascade,
  business_id    uuid not null references public.businesses (id) on delete cascade,
  status         text not null default 'active' check (status in ('active', 'left')),
  consent_scope  text[] not null default array['records'] check (consent_scope <@ array['records']::text[]),
  consented_at   timestamptz,
  consented_by   uuid references public.profiles (id),
  enrolled_at    timestamptz not null default now(),
  left_at        timestamptz,
  primary key (program_id, business_id)
);
create index program_enrollments_business_idx on public.program_enrollments (business_id);

create table public.partner_assignments (
  program_id       uuid not null references public.programs (id) on delete cascade,
  partner_user_id  uuid not null references public.profiles (id) on delete cascade,
  business_id      uuid not null references public.businesses (id) on delete cascade,
  created_at       timestamptz not null default now(),
  primary key (program_id, partner_user_id, business_id)
);
create index partner_assignments_partner_idx on public.partner_assignments (partner_user_id);

create table public.stripe_events (
  id            text primary key,
  type          text not null,
  program_id    uuid,
  processed_at  timestamptz not null default now()
);

-- ─── Access helpers ───────────────────────────────────────────────────────────
create function private.is_program_member(pid uuid, roles public.program_role[] default array['admin', 'partner']::public.program_role[])
returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.program_members where program_id = pid and user_id = (select auth.uid()) and role = any (roles));
$$;

-- Program-derived access to a business: consent must be active, and the viewer must be a program
-- admin or the partner assigned to that business.
create function private.program_role_for(bid uuid) returns public.business_role
language sql stable security definer set search_path = '' as $$
  select case
    when exists (
      select 1 from public.program_enrollments e
      join public.program_members m on m.program_id = e.program_id and m.user_id = (select auth.uid()) and m.role = 'admin'
      where e.business_id = bid and e.status = 'active' and 'records' = any (e.consent_scope)
    ) then 'program_admin'::public.business_role
    when exists (
      select 1 from public.program_enrollments e
      join public.partner_assignments a on a.program_id = e.program_id and a.business_id = bid and a.partner_user_id = (select auth.uid())
      join public.program_members m on m.program_id = e.program_id and m.user_id = a.partner_user_id
      where e.business_id = bid and e.status = 'active' and 'records' = any (e.consent_scope)
    ) then 'partner'::public.business_role
  end;
$$;

create or replace function private.can_read(bid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_member(bid) or private.program_role_for(bid) is not null;
$$;

-- The caller's effective role for a business (direct membership wins over program access).
create function public.my_business_role(p_business_id uuid) returns public.business_role
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select role from public.memberships where business_id = p_business_id and user_id = (select auth.uid())),
    private.program_role_for(p_business_id)
  );
$$;
revoke execute on function public.my_business_role(uuid) from public, anon;
grant execute on function public.my_business_role(uuid) to authenticated;
grant execute on function private.is_program_member(uuid, public.program_role[]), private.program_role_for(uuid) to authenticated;

-- Verifications: program admins and assigned partners vouch through their program relationship.
create or replace function public.add_verification(
  p_business_id uuid, p_subject_type public.verification_subject, p_level public.provenance, p_method text,
  p_subject_id uuid default null, p_note text default null, p_evidence_path text default null,
  p_period_start date default null, p_period_end date default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  r public.business_role := public.my_business_role(p_business_id);
  vid uuid;
begin
  if r is null
     or (p_level = 'document_backed' and r not in ('owner', 'staff'))
     or (p_level = 'third_party_verified' and r not in ('partner', 'program_admin'))
     or (p_level = 'institution_verified' and r <> 'program_admin')
     or p_level = 'self_reported' then
    raise exception 'You can''t add this level of verification' using errcode = '42501';
  end if;
  if p_subject_type <> 'business' and not exists (
    select 1 from public.sales where p_subject_type = 'sale' and id = p_subject_id and business_id = p_business_id
    union all select 1 from public.expenses where p_subject_type = 'expense' and id = p_subject_id and business_id = p_business_id
    union all select 1 from public.stock_movements where p_subject_type = 'stock_movement' and id = p_subject_id and business_id = p_business_id
  ) then
    raise exception 'Record not found' using errcode = 'P0002';
  end if;

  insert into public.verifications (business_id, subject_type, subject_id, level, method, note, evidence_path,
                                    period_start, period_end, verifier_role)
  values (p_business_id, p_subject_type, p_subject_id, p_level, p_method, p_note, p_evidence_path,
          p_period_start, p_period_end, r)
  returning id into vid;

  if p_subject_type = 'sale' then
    update public.sales set provenance = p_level where id = p_subject_id and private.provenance_rank(provenance) < private.provenance_rank(p_level);
  elsif p_subject_type = 'expense' then
    update public.expenses set provenance = p_level where id = p_subject_id and private.provenance_rank(provenance) < private.provenance_rank(p_level);
  elsif p_subject_type = 'stock_movement' then
    update public.stock_movements set provenance = p_level where id = p_subject_id and private.provenance_rank(provenance) < private.provenance_rank(p_level);
  elsif p_period_start is not null and p_period_end is not null then
    update public.sales set provenance = p_level
    where business_id = p_business_id and voided_at is null
      and occurred_at >= p_period_start and occurred_at < p_period_end + 1
      and private.provenance_rank(provenance) < private.provenance_rank(p_level)
      and p_method in ('bank_statement', 'mobile_money_statement');
  end if;

  perform private.emit_event(p_business_id, 'verification.added', 'verification', vid,
    jsonb_build_object('level', p_level, 'method', p_method, 'subject', p_subject_type, 'by', r));
  return vid;
end $$;

-- ─── RPCs ─────────────────────────────────────────────────────────────────────
create function public.create_program(p_name text, p_sponsor_name text default null, p_description text default null)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  pid uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  insert into public.programs (name, sponsor_name, description) values (trim(p_name), nullif(trim(p_sponsor_name), ''), p_description)
  returning id into pid;
  insert into public.program_members (program_id, user_id, role) values (pid, auth.uid(), 'admin');
  return pid;
end $$;

-- Business owners join with a code and explicit consent. Seats beyond the pilot need a subscription.
create function public.join_program(p_business_id uuid, p_join_code text, p_consent boolean) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  p public.programs;
  active_count int;
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
  perform private.emit_event(p_business_id, 'program.joined', 'program', p.id, jsonb_build_object('name', p.name));
  return p.id;
end $$;

-- Leaving withdraws consent immediately: program admins and partners lose access at once.
create function public.leave_program(p_business_id uuid, p_program_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.has_role(p_business_id, array['owner']::public.business_role[]) then
    raise exception 'Only the owner can leave a program' using errcode = '42501';
  end if;
  update public.program_enrollments set status = 'left', consent_scope = '{}', left_at = now()
  where program_id = p_program_id and business_id = p_business_id and status = 'active';
  delete from public.partner_assignments where program_id = p_program_id and business_id = p_business_id;
  perform private.emit_event(p_business_id, 'program.left', 'program', p_program_id, '{}');
end $$;

create function public.add_program_member(p_program_id uuid, p_contact text, p_role public.program_role) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  target uuid;
  contact text := lower(trim(p_contact));
begin
  if not private.is_program_member(p_program_id, array['admin']::public.program_role[]) then
    raise exception 'Only program admins can add people' using errcode = '42501';
  end if;
  select u.id into target from auth.users u
  where lower(u.email) = contact or u.phone = regexp_replace(contact, '[^0-9]', '', 'g') limit 1;
  if target is null then
    raise exception 'No Foundry account uses that phone or email yet' using errcode = 'P0002';
  end if;
  insert into public.program_members (program_id, user_id, role) values (p_program_id, target, p_role)
  on conflict (program_id, user_id) do update set role = excluded.role;
  return target;
end $$;

create function public.assign_partner(p_program_id uuid, p_partner_user_id uuid, p_business_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_program_member(p_program_id, array['admin']::public.program_role[]) then
    raise exception 'Only program admins can assign partners' using errcode = '42501';
  end if;
  if not exists (select 1 from public.program_members where program_id = p_program_id and user_id = p_partner_user_id) then
    raise exception 'That person is not part of this program' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.program_enrollments where program_id = p_program_id and business_id = p_business_id and status = 'active') then
    raise exception 'That business is not enrolled' using errcode = 'P0002';
  end if;
  insert into public.partner_assignments (program_id, partner_user_id, business_id) values (p_program_id, p_partner_user_id, p_business_id)
  on conflict do nothing;
end $$;

revoke execute on function public.create_program(text, text, text), public.join_program(uuid, text, boolean),
  public.leave_program(uuid, uuid), public.add_program_member(uuid, text, public.program_role),
  public.assign_partner(uuid, uuid, uuid) from public, anon;
grant execute on function public.create_program(text, text, text), public.join_program(uuid, text, boolean),
  public.leave_program(uuid, uuid), public.add_program_member(uuid, text, public.program_role),
  public.assign_partner(uuid, uuid, uuid) to authenticated;

-- ─── RLS ──────────────────────────────────────────────────────────────────────
alter table public.programs enable row level security;
alter table public.program_members enable row level security;
alter table public.program_enrollments enable row level security;
alter table public.partner_assignments enable row level security;
alter table public.stripe_events enable row level security;

create policy "programs: members read" on public.programs for select to authenticated
  using (private.is_program_member(id) or exists (
    select 1 from public.program_enrollments e where e.program_id = id and private.is_member(e.business_id)));
create policy "programs: admins edit" on public.programs for update to authenticated
  using (private.is_program_member(id, array['admin']::public.program_role[]))
  with check (private.is_program_member(id, array['admin']::public.program_role[]));
create policy "program members: read" on public.program_members for select to authenticated
  using (user_id = (select auth.uid()) or private.is_program_member(program_id, array['admin']::public.program_role[]));
create policy "program members: admins remove" on public.program_members for delete to authenticated
  using (private.is_program_member(program_id, array['admin']::public.program_role[]) and user_id <> (select auth.uid()));
create policy "enrollments: program staff and owners read" on public.program_enrollments for select to authenticated
  using (private.is_member(business_id) or private.is_program_member(program_id, array['admin']::public.program_role[])
         or exists (select 1 from public.partner_assignments a where a.program_id = program_enrollments.program_id
                    and a.business_id = program_enrollments.business_id and a.partner_user_id = (select auth.uid())));
create policy "assignments: read" on public.partner_assignments for select to authenticated
  using (partner_user_id = (select auth.uid()) or private.is_program_member(program_id, array['admin']::public.program_role[]));

revoke insert, update, delete on public.program_enrollments, public.partner_assignments from authenticated;
revoke insert, delete on public.programs from authenticated;
revoke update on public.programs from authenticated;
grant update (name, sponsor_name, description, status, seats) on public.programs to authenticated;
revoke insert, update on public.program_members from authenticated;
revoke all on public.stripe_events from authenticated;
