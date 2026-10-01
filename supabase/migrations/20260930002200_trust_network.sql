-- B24 Trust network: identified verifiers attest to specific, consented claims using the minimum
-- necessary evidence. Attestations expire, can be disputed and corrected, and keep full history.
-- There is deliberately no business-level "trusted" status. Reuses B8 provenance/verifications,
-- B10 programs, B17 providers, B19 identifiers, B16 consent pattern.

create table public.verifiers (
  id              uuid primary key default gen_random_uuid(),
  name            text not null check (char_length(name) between 3 and 120),
  kind            text not null check (kind in ('institution', 'program', 'provider', 'auditor', 'individual')),
  accreditation   text check (char_length(accreditation) <= 300),
  program_id      uuid references public.programs (id) on delete set null,
  provider_id     uuid references public.providers (id) on delete set null,
  allowed_claims  text[] not null check (allowed_claims <@ array['sales_total_period', 'registration']::text[] and cardinality(allowed_claims) > 0),
  status          text not null default 'pending' check (status in ('pending', 'approved', 'suspended')),
  created_by      uuid not null default auth.uid() references public.profiles (id),
  created_at      timestamptz not null default now()
);
create table public.verifier_members (
  verifier_id  uuid not null references public.verifiers (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  primary key (verifier_id, user_id)
);
create index verifier_members_user_idx on public.verifier_members (user_id);
create trigger verifiers_audit after insert or update on public.verifiers for each row execute function private.audit_row();

create function private.is_verifier_member(vid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.verifier_members where verifier_id = vid and user_id = (select auth.uid()));
$$;
grant execute on function private.is_verifier_member(uuid) to authenticated;

create table public.verification_requests (
  id                 uuid primary key default gen_random_uuid(),
  business_id        uuid not null references public.businesses (id) on delete cascade,
  verifier_id        uuid not null references public.verifiers (id) on delete cascade,
  claim_type         text not null check (claim_type in ('sales_total_period', 'registration')),
  claim              jsonb not null,   -- the exact assertion, computed from the books at request time
  scope              jsonb not null,   -- what the verifier may see, nothing more
  status             text not null default 'requested' check (status in ('requested', 'attested', 'withdrawn', 'expired')),
  consented_by       uuid not null default auth.uid() references public.profiles (id),
  access_expires_at  timestamptz not null default now() + interval '30 days',
  created_at         timestamptz not null default now()
);
create index verification_requests_business_idx on public.verification_requests (business_id, created_at desc);
create index verification_requests_verifier_idx on public.verification_requests (verifier_id, status);
create trigger verification_requests_audit after insert or update on public.verification_requests for each row execute function private.audit_row();

create table public.attestations (
  id           uuid primary key default gen_random_uuid(),
  request_id   uuid not null references public.verification_requests (id) on delete cascade,
  business_id  uuid not null references public.businesses (id) on delete cascade,
  verifier_id  uuid not null references public.verifiers (id),
  claim_type   text not null,
  claim        jsonb not null,
  result       text not null check (result in ('confirmed', 'partially_confirmed', 'not_confirmed')),
  method       text not null check (method in ('records_review', 'bank_statement', 'mobile_money_statement', 'registry_check', 'site_visit', 'other')),
  note         text check (char_length(note) <= 1000),
  status       text not null default 'active' check (status in ('active', 'disputed', 'corrected', 'revoked', 'expired')),
  supersedes   uuid references public.attestations (id),
  attested_by  uuid not null default auth.uid() references public.profiles (id),
  attested_at  timestamptz not null default now(),
  valid_until  timestamptz not null default now() + interval '12 months'
);
create index attestations_business_idx on public.attestations (business_id, attested_at desc);
create index attestations_request_idx on public.attestations (request_id);
create trigger attestations_audit after insert or update on public.attestations for each row execute function private.audit_row();

create table public.attestation_disputes (
  id              uuid primary key default gen_random_uuid(),
  attestation_id  uuid not null references public.attestations (id) on delete cascade,
  business_id     uuid not null references public.businesses (id) on delete cascade,
  raised_by       uuid not null default auth.uid() references public.profiles (id),
  reason          text not null check (char_length(reason) between 5 and 1000),
  status          text not null default 'open' check (status in ('open', 'upheld', 'rejected')),
  resolution      text,
  resolved_by     uuid references public.profiles (id),
  created_at      timestamptz not null default now(),
  resolved_at     timestamptz
);
create index attestation_disputes_business_idx on public.attestation_disputes (business_id);
create trigger attestation_disputes_audit after insert or update on public.attestation_disputes for each row execute function private.audit_row();

-- ─── RPCs ─────────────────────────────────────────────────────────────────────
create function public.register_verifier(p_name text, p_kind text, p_allowed_claims text[], p_accreditation text default null,
  p_program_id uuid default null, p_provider_id uuid default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  vid uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if (p_program_id is not null and not private.is_program_member(p_program_id, array['admin']::public.program_role[]))
     or (p_provider_id is not null and not private.is_provider_member(p_provider_id)) then
    raise exception 'You can only register a verifier for your own program or provider' using errcode = '42501';
  end if;
  insert into public.verifiers (name, kind, allowed_claims, accreditation, program_id, provider_id)
  values (trim(p_name), p_kind, p_allowed_claims, p_accreditation, p_program_id, p_provider_id) returning id into vid;
  insert into public.verifier_members (verifier_id, user_id) values (vid, auth.uid());
  return vid;
end $$;

create function public.review_verifier(p_verifier_id uuid, p_status text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_platform_admin() then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
  if p_status not in ('approved', 'suspended') then
    raise exception 'Status must be approved or suspended' using errcode = '22023';
  end if;
  update public.verifiers set status = p_status where id = p_verifier_id;
end $$;

-- Owner asks a verifier to check one claim. The claim is computed from the books now; the scope
-- lists exactly which records (or identifier) the verifier may see.
create function public.request_verification(p_business_id uuid, p_verifier_id uuid, p_claim_type text, p_params jsonb, p_consent boolean)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v public.verifiers;
  claim jsonb;
  scope jsonb;
  ps date;
  pe date;
  rid uuid;
begin
  if not private.has_role(p_business_id, array['owner']::public.business_role[]) then
    raise exception 'Only the owner can share records for verification' using errcode = '42501';
  end if;
  if not coalesce(p_consent, false) then
    raise exception 'Verification needs your consent to share the listed records' using errcode = 'P0001';
  end if;
  select * into v from public.verifiers where id = p_verifier_id;
  if v.id is null or v.status <> 'approved' or not (p_claim_type = any (v.allowed_claims)) then
    raise exception 'That verifier can''t check this kind of claim' using errcode = 'P0001';
  end if;
  if p_claim_type = 'sales_total_period' then
    ps := (p_params ->> 'period_start')::date;
    pe := (p_params ->> 'period_end')::date;
    if ps is null or pe is null or pe < ps or pe - ps > 366 then
      raise exception 'Choose a period of up to a year' using errcode = '22023';
    end if;
    select jsonb_build_object('period_start', ps, 'period_end', pe, 'total_minor', coalesce(sum(total_minor), 0), 'count', count(*),
             'currency', (select currency from public.businesses where id = p_business_id)),
           jsonb_build_object('sale_ids', coalesce(jsonb_agg(id order by occurred_at), '[]'))
      into claim, scope
    from public.sales where business_id = p_business_id and voided_at is null and occurred_at::date between ps and pe;
    if (claim ->> 'count')::int = 0 then
      raise exception 'There are no sales in that period to verify' using errcode = 'P0001';
    end if;
  else
    select jsonb_build_object('type', type, 'value', value), jsonb_build_object('identifier_type', type)
      into claim, scope
    from public.business_identifiers where business_id = p_business_id and type = p_params ->> 'type';
    if claim is null then
      raise exception 'Add that registration number first' using errcode = 'P0001';
    end if;
  end if;
  insert into public.verification_requests (business_id, verifier_id, claim_type, claim, scope)
  values (p_business_id, p_verifier_id, p_claim_type, claim, scope) returning id into rid;
  perform private.emit_event(p_business_id, 'verification.requested', 'verification_request', rid,
    jsonb_build_object('verifier', v.name, 'claim_type', p_claim_type));
  return rid;
end $$;

create function public.withdraw_verification_request(p_request_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.verification_requests set status = 'withdrawn', access_expires_at = now()
  where id = p_request_id and status = 'requested' and private.has_role(business_id, array['owner']::public.business_role[]);
  if not found then
    raise exception 'Request not found or already handled' using errcode = 'P0002';
  end if;
end $$;

-- What the verifier sees: the claim plus the minimum fields of scoped records. No customer
-- names, no items, no notes, nothing outside the scope, nothing after access expires.
create function public.verification_request_evidence(p_request_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  r public.verification_requests;
begin
  select * into r from public.verification_requests where id = p_request_id;
  if not found or not private.is_verifier_member(r.verifier_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if r.status <> 'requested' or r.access_expires_at < now() then
    raise exception 'Access to this evidence has ended' using errcode = 'P0001';
  end if;
  return jsonb_build_object(
    'business', (select name from public.businesses where id = r.business_id),
    'claim_type', r.claim_type, 'claim', r.claim, 'access_expires_at', r.access_expires_at,
    'records', case when r.claim_type = 'sales_total_period' then (
      select coalesce(jsonb_agg(jsonb_build_object('date', s.occurred_at::date, 'total_minor', s.total_minor, 'payment_method', s.payment_method,
        'provenance', s.provenance) order by s.occurred_at), '[]')
      from public.sales s where s.id in (select (jsonb_array_elements_text(r.scope -> 'sale_ids'))::uuid) and s.voided_at is null) end);
end $$;

create function public.attest_claim(p_request_id uuid, p_result text, p_method text, p_note text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  r public.verification_requests;
  aid uuid;
begin
  select * into r from public.verification_requests where id = p_request_id for update;
  if not found or not private.is_verifier_member(r.verifier_id)
     or not exists (select 1 from public.verifiers where id = r.verifier_id and status = 'approved') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if r.status <> 'requested' or r.access_expires_at < now() then
    raise exception 'This request is no longer open' using errcode = 'P0001';
  end if;
  insert into public.attestations (request_id, business_id, verifier_id, claim_type, claim, result, method, note)
  values (r.id, r.business_id, r.verifier_id, r.claim_type, r.claim, p_result, p_method, p_note) returning id into aid;
  update public.verification_requests set status = 'attested', access_expires_at = now() where id = r.id;
  if r.claim_type = 'registration' and p_result = 'confirmed' then
    update public.business_identifiers set verified = true where business_id = r.business_id and type = r.claim ->> 'type' and value = r.claim ->> 'value';
  end if;
  perform private.emit_event(r.business_id, 'verification.attested', 'attestation', aid, jsonb_build_object('claim_type', r.claim_type, 'result', p_result));
  return aid;
end $$;

-- Owner or the verifier can dispute; while open the attestation is marked disputed.
create function public.dispute_attestation(p_attestation_id uuid, p_reason text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  a public.attestations;
  did uuid;
begin
  select * into a from public.attestations where id = p_attestation_id;
  if not found or not (private.has_role(a.business_id, array['owner']::public.business_role[]) or private.is_verifier_member(a.verifier_id)) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if a.status <> 'active' then
    raise exception 'Only active attestations can be disputed' using errcode = 'P0001';
  end if;
  insert into public.attestation_disputes (attestation_id, business_id, reason) values (a.id, a.business_id, p_reason) returning id into did;
  update public.attestations set status = 'disputed' where id = a.id;
  perform private.emit_event(a.business_id, 'verification.disputed', 'attestation', a.id, jsonb_build_object('dispute_id', did));
  return did;
end $$;

-- Platform admins resolve: upheld → revoked (the verifier may issue a correction); rejected → active again.
create function public.resolve_dispute(p_dispute_id uuid, p_decision text, p_resolution text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  d public.attestation_disputes;
begin
  if not private.is_platform_admin() then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
  if p_decision not in ('upheld', 'rejected') then
    raise exception 'Decision must be upheld or rejected' using errcode = '22023';
  end if;
  update public.attestation_disputes set status = p_decision, resolution = p_resolution, resolved_by = auth.uid(), resolved_at = now()
  where id = p_dispute_id and status = 'open' returning * into d;
  if not found then
    raise exception 'Dispute not found or already resolved' using errcode = 'P0002';
  end if;
  update public.attestations set status = case p_decision when 'upheld' then 'revoked' else 'active' end
  where id = d.attestation_id and status = 'disputed';
end $$;

-- The verifier corrects its own attestation: a new one supersedes it; the old one is kept.
create function public.correct_attestation(p_attestation_id uuid, p_result text, p_note text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  a public.attestations;
  nid uuid;
begin
  select * into a from public.attestations where id = p_attestation_id;
  if not found or not private.is_verifier_member(a.verifier_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if a.status not in ('active', 'disputed', 'revoked') then
    raise exception 'That attestation was already corrected' using errcode = 'P0001';
  end if;
  insert into public.attestations (request_id, business_id, verifier_id, claim_type, claim, result, method, note, supersedes)
  values (a.request_id, a.business_id, a.verifier_id, a.claim_type, a.claim, p_result, a.method, p_note, a.id) returning id into nid;
  update public.attestations set status = 'corrected' where id = a.id;
  update public.attestation_disputes set status = 'upheld', resolution = coalesce(resolution, 'Corrected by the verifier'), resolved_at = now()
  where attestation_id = a.id and status = 'open';
  perform private.emit_event(a.business_id, 'verification.corrected', 'attestation', nid, jsonb_build_object('supersedes', a.id, 'result', p_result));
  return nid;
end $$;

-- Full history for one business: every attestation (including superseded) and dispute.
create function public.verification_history(p_business_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not private.can_read(p_business_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  update public.attestations set status = 'expired' where business_id = p_business_id and status = 'active' and valid_until < now();
  return (select coalesce(jsonb_agg(jsonb_build_object(
      'id', a.id, 'verifier', v.name, 'verifier_kind', v.kind, 'claim_type', a.claim_type, 'claim', a.claim, 'result', a.result,
      'method', a.method, 'note', a.note, 'status', a.status, 'supersedes', a.supersedes, 'attested_at', a.attested_at, 'valid_until', a.valid_until,
      'disputes', (select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'reason', d.reason, 'status', d.status, 'resolution', d.resolution, 'at', d.created_at)
                   order by d.created_at), '[]') from public.attestation_disputes d where d.attestation_id = a.id))
    order by a.attested_at desc), '[]')
    from public.attestations a join public.verifiers v on v.id = a.verifier_id where a.business_id = p_business_id);
end $$;

revoke execute on function public.register_verifier(text, text, text[], text, uuid, uuid), public.review_verifier(uuid, text),
  public.request_verification(uuid, uuid, text, jsonb, boolean), public.withdraw_verification_request(uuid),
  public.verification_request_evidence(uuid), public.attest_claim(uuid, text, text, text), public.dispute_attestation(uuid, text),
  public.resolve_dispute(uuid, text, text), public.correct_attestation(uuid, text, text), public.verification_history(uuid) from public, anon;
grant execute on function public.register_verifier(text, text, text[], text, uuid, uuid), public.review_verifier(uuid, text),
  public.request_verification(uuid, uuid, text, jsonb, boolean), public.withdraw_verification_request(uuid),
  public.verification_request_evidence(uuid), public.attest_claim(uuid, text, text, text), public.dispute_attestation(uuid, text),
  public.resolve_dispute(uuid, text, text), public.correct_attestation(uuid, text, text), public.verification_history(uuid) to authenticated;

-- ─── RLS ──────────────────────────────────────────────────────────────────────
alter table public.verifiers enable row level security;
alter table public.verifier_members enable row level security;
alter table public.verification_requests enable row level security;
alter table public.attestations enable row level security;
alter table public.attestation_disputes enable row level security;
create policy "verifiers: approved, own, admins" on public.verifiers for select to authenticated
  using (status = 'approved' or private.is_verifier_member(id) or private.is_platform_admin());
create policy "verifier members: own" on public.verifier_members for select to authenticated using (user_id = (select auth.uid()));
-- Verifiers see request metadata (the claim), not records; records only via the scoped RPC.
create policy "requests: business or verifier" on public.verification_requests for select to authenticated
  using (private.can_read(business_id) or private.is_verifier_member(verifier_id));
create policy "attestations: business, verifier, admins" on public.attestations for select to authenticated
  using (private.can_read(business_id) or private.is_verifier_member(verifier_id) or private.is_platform_admin());
create policy "disputes: business, verifier, admins" on public.attestation_disputes for select to authenticated
  using (private.can_read(business_id) or private.is_platform_admin()
         or exists (select 1 from public.attestations a where a.id = attestation_id and private.is_verifier_member(a.verifier_id)));
revoke insert, update, delete on public.verifiers, public.verifier_members, public.verification_requests, public.attestations, public.attestation_disputes from authenticated;

-- Verifier console: own attestations with the business name (verifiers have no business read access).
create function public.verifier_attestations() returns table (
  id uuid, business_name text, claim_type text, result text, status text, attested_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select a.id, b.name, a.claim_type, a.result, a.status, a.attested_at
  from public.attestations a join public.businesses b on b.id = a.business_id
  where a.verifier_id in (select verifier_id from public.verifier_members where user_id = (select auth.uid()))
  order by a.attested_at desc limit 50;
$$;
revoke execute on function public.verifier_attestations() from public, anon;
grant execute on function public.verifier_attestations() to authenticated;
