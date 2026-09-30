-- Batch 2: multi-tenant core. Every business-owned row carries business_id and is
-- guarded by RLS through the helpers in the `private` schema (not exposed by PostgREST).

create schema if not exists private;
grant usage on schema private to authenticated, service_role;

-- Anonymous callers get nothing from public tables by default; public surfaces
-- (passport share pages) go through server code with the service role.
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke execute on functions from anon, public;

create type public.business_role as enum ('owner', 'staff', 'partner', 'program_admin');

-- ─── Shared trigger: updated_at ───────────────────────────────────────────────
create function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ─── Profiles ─────────────────────────────────────────────────────────────────
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text check (char_length(full_name) <= 120),
  phone       text,
  email       text,
  locale      text not null default 'en' check (char_length(locale) <= 16),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger profiles_touch before update on public.profiles
  for each row execute function private.touch_updated_at();

create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, phone, email, full_name)
  values (new.id, new.phone, new.email, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- ─── Businesses & memberships ─────────────────────────────────────────────────
create table public.businesses (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (char_length(name) between 2 and 120),
  sector        text check (char_length(sector) <= 60),
  country_code  text not null default 'NG' check (country_code ~ '^[A-Z]{2}$'),
  currency      text not null default 'NGN' check (currency ~ '^[A-Z]{3}$'),
  timezone      text not null default 'Africa/Lagos',
  created_by    uuid not null references auth.users (id),
  archived_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger businesses_touch before update on public.businesses
  for each row execute function private.touch_updated_at();

create table public.memberships (
  business_id  uuid not null references public.businesses (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  role         public.business_role not null,
  created_at   timestamptz not null default now(),
  primary key (business_id, user_id)
);
create index memberships_user_idx on public.memberships (user_id);

-- ─── RLS helpers (security definer so policies don't recurse through memberships RLS) ──
create function private.is_member(bid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.business_id = bid and m.user_id = (select auth.uid())
  );
$$;

create function private.has_role(bid uuid, roles public.business_role[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.business_id = bid and m.user_id = (select auth.uid()) and m.role = any (roles)
  );
$$;

-- Read access. Batch 10 extends this with consented program-partner access.
create function private.can_read(bid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_member(bid);
$$;

-- Write access to operational records: the people who run the business.
create function private.can_write(bid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.has_role(bid, array['owner', 'staff']::public.business_role[]);
$$;

grant execute on function private.is_member(uuid), private.has_role(uuid, public.business_role[]),
  private.can_read(uuid), private.can_write(uuid) to authenticated, service_role;

-- A business must always keep at least one owner.
create function private.protect_last_owner() returns trigger
language plpgsql set search_path = '' as $$
declare
  bid uuid := coalesce(old.business_id, new.business_id);
begin
  if old.role = 'owner'
     and (tg_op = 'DELETE' or new.role <> 'owner')
     and not exists (
       select 1 from public.memberships
       where business_id = bid and role = 'owner' and user_id <> old.user_id
     )
     and exists (select 1 from public.businesses where id = bid) then
    raise exception 'A business must keep at least one owner' using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end $$;
create trigger memberships_last_owner before update or delete on public.memberships
  for each row execute function private.protect_last_owner();

-- ─── RPCs ─────────────────────────────────────────────────────────────────────
-- Creating a business and its first owner must be atomic (and can't pass RLS in two steps).
create function public.create_business(
  p_name text, p_sector text default null, p_country_code text default 'NG',
  p_currency text default 'NGN', p_timezone text default 'Africa/Lagos'
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  bid uuid;
begin
  if uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  insert into public.businesses (name, sector, country_code, currency, timezone, created_by)
  values (trim(p_name), nullif(trim(p_sector), ''), upper(p_country_code), upper(p_currency), p_timezone, uid)
  returning id into bid;
  insert into public.memberships (business_id, user_id, role) values (bid, uid, 'owner');
  return bid;
end $$;
revoke execute on function public.create_business(text, text, text, text, text) from public, anon;
grant execute on function public.create_business(text, text, text, text, text) to authenticated;

-- Owners add existing users by phone (E.164 digits) or email.
create function public.add_member(p_business_id uuid, p_contact text, p_role public.business_role)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  target uuid;
  contact text := lower(trim(p_contact));
begin
  if not private.has_role(p_business_id, array['owner']::public.business_role[]) then
    raise exception 'Only owners can add members' using errcode = '42501';
  end if;
  select u.id into target from auth.users u
  where lower(u.email) = contact or u.phone = regexp_replace(contact, '[^0-9]', '', 'g')
  limit 1;
  if target is null then
    raise exception 'No Foundry account uses that phone or email yet' using errcode = 'P0002';
  end if;
  insert into public.memberships (business_id, user_id, role) values (p_business_id, target, p_role)
  on conflict (business_id, user_id) do update set role = excluded.role;
  return target;
end $$;
revoke execute on function public.add_member(uuid, text, public.business_role) from public, anon;
grant execute on function public.add_member(uuid, text, public.business_role) to authenticated;

-- ─── RLS ──────────────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.memberships enable row level security;

create policy "profiles: read self and co-members" on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1 from public.memberships theirs
      where theirs.user_id = profiles.id and private.is_member(theirs.business_id)
    )
  );
create policy "profiles: update self" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "businesses: readers" on public.businesses for select to authenticated
  using (private.can_read(id));
create policy "businesses: owners update" on public.businesses for update to authenticated
  using (private.has_role(id, array['owner']::public.business_role[]))
  with check (private.has_role(id, array['owner']::public.business_role[]));

create policy "memberships: members see team" on public.memberships for select to authenticated
  using (user_id = (select auth.uid()) or private.is_member(business_id));
create policy "memberships: owners manage" on public.memberships for update to authenticated
  using (private.has_role(business_id, array['owner']::public.business_role[]))
  with check (private.has_role(business_id, array['owner']::public.business_role[]));
create policy "memberships: owners remove or self leave" on public.memberships for delete to authenticated
  using (user_id = (select auth.uid()) or private.has_role(business_id, array['owner']::public.business_role[]));

grant select, update on public.profiles to authenticated;
grant select, update on public.businesses to authenticated;
grant select, update, delete on public.memberships to authenticated;
