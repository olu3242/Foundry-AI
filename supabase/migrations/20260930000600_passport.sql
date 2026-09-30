-- Batch 8: Passport — a consented, revocable view of a business's recorded track record,
-- showing how every number is backed. Explicitly not a credit score.

create type public.verification_subject as enum ('business', 'sale', 'expense', 'stock_movement');

create table public.verifications (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references public.businesses (id) on delete cascade,
  subject_type   public.verification_subject not null,
  subject_id     uuid,
  level          public.provenance not null check (level <> 'self_reported'),
  method         text not null check (method in ('receipt', 'invoice', 'bank_statement', 'mobile_money_statement',
                   'registration_certificate', 'tax_certificate', 'site_visit', 'program_review', 'other')),
  period_start   date,
  period_end     date,
  note           text check (char_length(note) <= 500),
  evidence_path  text,
  verified_by    uuid not null default auth.uid() references public.profiles (id),
  verifier_role  public.business_role not null,
  created_at     timestamptz not null default now(),
  constraint verifications_subject check ((subject_type = 'business') = (subject_id is null)),
  constraint verifications_path_scoped check (evidence_path is null or evidence_path like business_id::text || '/%')
);
create index verifications_business_idx on public.verifications (business_id, created_at desc);

create table public.passport_shares (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses (id) on delete cascade,
  token_hash      text not null unique,
  label           text not null check (char_length(label) between 2 and 80),
  sections        text[] not null check (sections <@ array['summary', 'track_record', 'proof', 'pulse']::text[] and cardinality(sections) > 0),
  expires_at      timestamptz not null,
  revoked_at      timestamptz,
  created_by      uuid not null default auth.uid() references public.profiles (id),
  created_at      timestamptz not null default now(),
  view_count      int not null default 0,
  last_viewed_at  timestamptz
);
create index passport_shares_business_idx on public.passport_shares (business_id, created_at desc);

create table public.passport_views (
  id          bigint generated always as identity primary key,
  share_id    uuid not null references public.passport_shares (id) on delete cascade,
  business_id uuid not null references public.businesses (id) on delete cascade,
  viewed_at   timestamptz not null default now(),
  viewer_hash text
);
create index passport_views_share_idx on public.passport_views (share_id, viewed_at desc);

-- Receipts photographed and confirmed are document-backed from the start.
create function private.provenance_from_capture() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.source_capture_id is not null and new.provenance = 'self_reported'
     and exists (select 1 from public.captures where id = new.source_capture_id and channel = 'photo') then
    new.provenance := 'document_backed';
  end if;
  return new;
end $$;
create trigger sales_provenance before insert on public.sales for each row execute function private.provenance_from_capture();
create trigger expenses_provenance before insert on public.expenses for each row execute function private.provenance_from_capture();

create function private.provenance_rank(p public.provenance) returns int
language sql immutable as $$
  select array_position(array['self_reported', 'document_backed', 'third_party_verified', 'institution_verified']::public.provenance[], p);
$$;

/*
 * Adds a verification. Who may vouch for what:
 *   document_backed        owner/staff (they hold the document)
 *   third_party_verified   a business partner or program admin (not the operators themselves)
 *   institution_verified   program admins only
 */
create function public.add_verification(
  p_business_id uuid, p_subject_type public.verification_subject, p_level public.provenance, p_method text,
  p_subject_id uuid default null, p_note text default null, p_evidence_path text default null,
  p_period_start date default null, p_period_end date default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  r public.business_role;
  vid uuid;
begin
  select role into r from public.memberships where business_id = p_business_id and user_id = auth.uid();
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

  -- Raise (never lower) the subject record's provenance.
  if p_subject_type = 'sale' then
    update public.sales set provenance = p_level where id = p_subject_id and private.provenance_rank(provenance) < private.provenance_rank(p_level);
  elsif p_subject_type = 'expense' then
    update public.expenses set provenance = p_level where id = p_subject_id and private.provenance_rank(provenance) < private.provenance_rank(p_level);
  elsif p_subject_type = 'stock_movement' then
    update public.stock_movements set provenance = p_level where id = p_subject_id and private.provenance_rank(provenance) < private.provenance_rank(p_level);
  elsif p_period_start is not null and p_period_end is not null then
    -- A statement covering a period backs the records inside it.
    update public.sales set provenance = p_level
    where business_id = p_business_id and voided_at is null
      and occurred_at >= p_period_start and occurred_at < p_period_end + 1
      and private.provenance_rank(provenance) < private.provenance_rank(p_level)
      and p_method in ('bank_statement', 'mobile_money_statement');
  end if;

  perform private.emit_event(p_business_id, 'verification.added', 'verification', vid,
    jsonb_build_object('level', p_level, 'method', p_method, 'subject', p_subject_type));
  return vid;
end $$;
revoke execute on function public.add_verification(uuid, public.verification_subject, public.provenance, text, uuid, text, text, date, date) from public, anon;
grant execute on function public.add_verification(uuid, public.verification_subject, public.provenance, text, uuid, text, text, date, date) to authenticated;

-- Aggregates for the Passport (service role for public share pages, invoker-safe for members).
create function public.passport_facts(p_business_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  with b as (select * from public.businesses where id = p_business_id),
  s as (select * from public.sales where business_id = p_business_id and voided_at is null),
  e as (select * from public.expenses where business_id = p_business_id and voided_at is null),
  recs as (select occurred_at, provenance from s union all select occurred_at, provenance from e)
  select jsonb_build_object(
    'name', b.name, 'sector', b.sector, 'country_code', b.country_code, 'currency', b.currency,
    'on_foundry_since', b.created_at,
    'first_record_at', (select min(occurred_at) from recs),
    'months_with_records', (select count(distinct date_trunc('month', occurred_at at time zone b.timezone)) from recs),
    'active_days_90', (select count(distinct (occurred_at at time zone b.timezone)::date) from recs where occurred_at > now() - interval '90 days'),
    'records_180', (select count(*) from recs where occurred_at > now() - interval '180 days'),
    'provenance_180', (select coalesce(jsonb_object_agg(provenance, n), '{}') from (
        select provenance, count(*) n from recs where occurred_at > now() - interval '180 days' group by provenance) x),
    'monthly_sales', (select coalesce(jsonb_agg(jsonb_build_object('month', m, 'sales_minor', total) order by m), '[]') from (
        select to_char(date_trunc('month', occurred_at at time zone b.timezone), 'YYYY-MM') m, sum(total_minor) total
        from s where occurred_at > date_trunc('month', now()) - interval '5 months' group by 1) x),
    'highest_level', (select level from public.verifications v where v.business_id = p_business_id
        order by private.provenance_rank(level) desc limit 1),
    'verifications', (select coalesce(jsonb_agg(jsonb_build_object('level', level, 'method', method, 'subject', subject_type,
        'period_start', period_start, 'period_end', period_end, 'verifier_role', verifier_role, 'at', created_at) order by created_at desc), '[]')
        from (select * from public.verifications v where v.business_id = p_business_id order by created_at desc limit 20) v)
  ) from b;
$$;
revoke execute on function public.passport_facts(uuid) from public, anon, authenticated;
grant execute on function public.passport_facts(uuid) to service_role;

-- ─── RLS ──────────────────────────────────────────────────────────────────────
alter table public.verifications enable row level security;
alter table public.passport_shares enable row level security;
alter table public.passport_views enable row level security;

create policy "verifications: read" on public.verifications for select to authenticated using (private.can_read(business_id));
create policy "shares: owners read" on public.passport_shares for select to authenticated
  using (private.has_role(business_id, array['owner']::public.business_role[]));
create policy "shares: owners create" on public.passport_shares for insert to authenticated
  with check (private.has_role(business_id, array['owner']::public.business_role[]) and created_by = (select auth.uid()));
create policy "shares: owners revoke" on public.passport_shares for update to authenticated
  using (private.has_role(business_id, array['owner']::public.business_role[]))
  with check (private.has_role(business_id, array['owner']::public.business_role[]));
create policy "views: owners read" on public.passport_views for select to authenticated
  using (private.has_role(business_id, array['owner']::public.business_role[]));

revoke insert, update, delete on public.verifications, public.passport_views from authenticated;
revoke delete on public.passport_shares from authenticated;
-- Owners may only revoke; token, scope and expiry are immutable once shared.
revoke update on public.passport_shares from authenticated;
grant update (revoked_at) on public.passport_shares to authenticated;

create function private.share_events() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform private.emit_event(new.business_id, 'passport.shared', 'passport_share', new.id,
      jsonb_build_object('label', new.label, 'sections', new.sections, 'expires_at', new.expires_at));
  elsif new.revoked_at is not null and old.revoked_at is null then
    perform private.emit_event(new.business_id, 'passport.revoked', 'passport_share', new.id, jsonb_build_object('label', new.label));
  end if;
  return new;
end $$;
create trigger passport_shares_events after insert or update on public.passport_shares
  for each row execute function private.share_events();

-- ─── Evidence documents (private; never exposed through share links) ───────────
do $$
begin
  if to_regclass('storage.buckets') is null then
    return;
  end if;
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('evidence', 'evidence', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
  on conflict (id) do nothing;
  create policy "evidence bucket: read" on storage.objects for select to authenticated
    using (bucket_id = 'evidence' and private.can_read(((storage.foldername(name))[1])::uuid));
  create policy "evidence bucket: upload" on storage.objects for insert to authenticated
    with check (bucket_id = 'evidence' and private.can_read(((storage.foldername(name))[1])::uuid));
end $$;
