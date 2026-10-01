-- B16 Financial opportunity: partner-defined eligibility, consented bounded evidence packages,
-- submission state and partner decisions. Explicitly no score: every rule is pass/fail with its gap.
-- Reuses B8 passport_facts/verification ladder, B11 verified outcomes, B10/B15 lender programs.

create table public.financial_products (
  id                 uuid primary key default gen_random_uuid(),
  program_id         uuid not null references public.programs (id) on delete cascade,
  name               text not null check (char_length(name) between 3 and 120),
  description        text check (char_length(description) <= 2000),
  product_type       text not null check (product_type in ('working_capital', 'stock_financing', 'equipment', 'invoice_financing', 'grant', 'other')),
  currency           text not null check (currency ~ '^[A-Z]{3}$'),
  min_amount_minor   bigint check (min_amount_minor >= 0),
  max_amount_minor   bigint check (max_amount_minor >= 0),
  eligibility        jsonb not null default '{}',
  required_sections  text[] not null default array['summary', 'track_record', 'proof'],
  status             text not null default 'active' check (status in ('active', 'paused')),
  created_at         timestamptz not null default now()
);

create type public.package_status as enum ('submitted', 'under_review', 'approved', 'declined', 'withdrawn');

create table public.evidence_packages (
  id                      uuid primary key default gen_random_uuid(),
  business_id             uuid not null references public.businesses (id) on delete cascade,
  product_id              uuid not null references public.financial_products (id) on delete cascade,
  program_id              uuid not null references public.programs (id) on delete cascade,
  sections                text[] not null,
  snapshot                jsonb not null,
  snapshot_sha256         text not null,
  eligibility             jsonb not null,
  requested_amount_minor  bigint check (requested_amount_minor >= 0),
  purpose                 text check (char_length(purpose) <= 500),
  status                  public.package_status not null default 'submitted',
  submitted_by            uuid not null default auth.uid() references public.profiles (id),
  submitted_at            timestamptz not null default now(),
  expires_at              timestamptz not null default now() + interval '90 days',
  decided_by              uuid references public.profiles (id),
  decided_at              timestamptz,
  decision_note           text check (char_length(decision_note) <= 1000),
  decision_amount_minor   bigint
);
create index evidence_packages_business_idx on public.evidence_packages (business_id, submitted_at desc);
create index evidence_packages_program_idx on public.evidence_packages (program_id, submitted_at desc);
create trigger evidence_packages_audit after insert or update on public.evidence_packages for each row execute function private.audit_row();

-- Rule-by-rule check. Unknown rules are ignored; every known rule reports required vs actual.
create function private.check_eligibility(p_rules jsonb, p_facts jsonb, p_country text, p_sector text) returns jsonb
language sql stable set search_path = '' as $$
  with checks as (
    select 'country' rule, p_rules -> 'countries' required, to_jsonb(p_country) actual,
           p_country = any (array(select jsonb_array_elements_text(p_rules -> 'countries'))) pass
    where jsonb_array_length(coalesce(p_rules -> 'countries', '[]')) > 0
    union all
    select 'sector', p_rules -> 'sectors', to_jsonb(p_sector),
           coalesce(p_sector = any (array(select jsonb_array_elements_text(p_rules -> 'sectors'))), false)
    where jsonb_array_length(coalesce(p_rules -> 'sectors', '[]')) > 0
    union all
    select 'months_with_records', p_rules -> 'min_months_records', p_facts -> 'months_with_records',
           (p_facts ->> 'months_with_records')::int >= (p_rules ->> 'min_months_records')::int
    where p_rules ? 'min_months_records'
    union all
    select 'active_days_90', p_rules -> 'min_active_days_90', p_facts -> 'active_days_90',
           (p_facts ->> 'active_days_90')::int >= (p_rules ->> 'min_active_days_90')::int
    where p_rules ? 'min_active_days_90'
    union all
    select 'proof_level', p_rules -> 'min_proof_level', coalesce(p_facts -> 'highest_level', '"self_reported"'),
           private.provenance_rank(coalesce(p_facts ->> 'highest_level', 'self_reported')::public.provenance)
             >= private.provenance_rank((p_rules ->> 'min_proof_level')::public.provenance)
    where p_rules ? 'min_proof_level'
    union all
    select 'verified_outcomes', p_rules -> 'min_verified_outcomes', to_jsonb(jsonb_array_length(coalesce(p_facts -> 'verified_outcomes', '[]'))),
           jsonb_array_length(coalesce(p_facts -> 'verified_outcomes', '[]')) >= (p_rules ->> 'min_verified_outcomes')::int
    where p_rules ? 'min_verified_outcomes'
  )
  select jsonb_build_object(
    'eligible', coalesce(bool_and(pass), true),
    'checks', coalesce(jsonb_agg(jsonb_build_object('rule', rule, 'required', required, 'actual', actual, 'pass', pass)), '[]'),
    'note', 'Criteria set by the partner. Foundry does not score creditworthiness.'
  ) from checks;
$$;

-- Eligibility preview for the owner (no data leaves the business).
create function public.product_eligibility(p_business_id uuid, p_product_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  b public.businesses;
  f public.financial_products;
begin
  if not private.has_role(p_business_id, array['owner', 'staff']::public.business_role[]) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select * into b from public.businesses where id = p_business_id;
  select * into f from public.financial_products where id = p_product_id and status = 'active';
  if not found then
    raise exception 'Product not found' using errcode = 'P0002';
  end if;
  return private.check_eligibility(f.eligibility, public.passport_facts(p_business_id), b.country_code, b.sector);
end $$;

-- Owner shares a frozen, hashed, section-bounded package with one partner product.
create function public.submit_evidence_package(
  p_business_id uuid, p_product_id uuid, p_sections text[], p_amount_minor bigint, p_purpose text, p_consent boolean
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  b public.businesses;
  f public.financial_products;
  facts jsonb;
  pulse jsonb;
  secs text[];
  snap jsonb;
  pid uuid;
begin
  if not private.has_role(p_business_id, array['owner']::public.business_role[]) then
    raise exception 'Only the owner can share an evidence package' using errcode = '42501';
  end if;
  if not coalesce(p_consent, false) then
    raise exception 'Sharing needs your consent' using errcode = 'P0001';
  end if;
  select * into b from public.businesses where id = p_business_id;
  select * into f from public.financial_products where id = p_product_id and status = 'active';
  if not found then
    raise exception 'Product not found' using errcode = 'P0002';
  end if;
  secs := array(select distinct s from unnest(p_sections || f.required_sections) s
                where s = any (array['summary', 'track_record', 'proof', 'pulse', 'outcomes']) order by s);
  facts := public.passport_facts(p_business_id);
  select coalesce(jsonb_agg(jsonb_build_object('dimension', dimension, 'state', state, 'why', why)), '[]') into pulse
  from public.pulse_snapshots where business_id = p_business_id
    and computed_on = (select max(computed_on) from public.pulse_snapshots where business_id = p_business_id);

  -- Only the chosen sections leave; documents never do.
  snap := jsonb_strip_nulls(jsonb_build_object(
    'name', facts -> 'name', 'sector', facts -> 'sector', 'country_code', facts -> 'country_code', 'currency', facts -> 'currency',
    'on_foundry_since', facts -> 'on_foundry_since',
    'months_with_records', case when 'summary' = any (secs) then facts -> 'months_with_records' end,
    'active_days_90', case when 'summary' = any (secs) then facts -> 'active_days_90' end,
    'records_180', case when 'summary' = any (secs) then facts -> 'records_180' end,
    'monthly_sales', case when 'track_record' = any (secs) then facts -> 'monthly_sales' end,
    'provenance_180', case when 'proof' = any (secs) then facts -> 'provenance_180' end,
    'highest_level', case when 'proof' = any (secs) then facts -> 'highest_level' end,
    'verifications', case when 'proof' = any (secs) then facts -> 'verifications' end,
    'verified_outcomes', case when 'outcomes' = any (secs) or 'proof' = any (secs) then facts -> 'verified_outcomes' end,
    'pulse', case when 'pulse' = any (secs) then pulse end,
    'frozen_at', to_jsonb(now())
  ));
  insert into public.evidence_packages (business_id, product_id, program_id, sections, snapshot, snapshot_sha256, eligibility,
                                        requested_amount_minor, purpose)
  values (p_business_id, f.id, f.program_id, secs, snap, encode(extensions.digest(snap::text, 'sha256'), 'hex'),
          private.check_eligibility(f.eligibility, facts, b.country_code, b.sector), p_amount_minor, p_purpose)
  returning id into pid;
  perform private.emit_event(p_business_id, 'finance.shared', 'evidence_package', pid, jsonb_build_object('product', f.name, 'sections', secs));
  return pid;
end $$;

create function public.decide_evidence_package(p_package_id uuid, p_status public.package_status, p_note text default null, p_amount_minor bigint default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  p public.evidence_packages;
begin
  select * into p from public.evidence_packages where id = p_package_id for update;
  if not found or not private.is_program_member(p.program_id, array['admin']::public.program_role[]) then
    raise exception 'Not found' using errcode = 'P0002';
  end if;
  if p.status in ('withdrawn', 'approved', 'declined') or p_status not in ('under_review', 'approved', 'declined') then
    raise exception 'This package can no longer change' using errcode = 'P0001';
  end if;
  update public.evidence_packages set status = p_status, decided_by = auth.uid(), decided_at = now(),
         decision_note = p_note, decision_amount_minor = p_amount_minor
  where id = p.id;
  perform private.emit_event(p.business_id, 'finance.' || p_status::text, 'evidence_package', p.id, jsonb_build_object('note', p_note));
end $$;

-- Withdrawal removes the shared data (the hash stays so the audit trail still proves what was sent).
create function public.withdraw_evidence_package(p_package_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  p public.evidence_packages;
begin
  select * into p from public.evidence_packages where id = p_package_id for update;
  if not found or not private.has_role(p.business_id, array['owner']::public.business_role[]) then
    raise exception 'Not found' using errcode = 'P0002';
  end if;
  update public.evidence_packages set status = 'withdrawn', snapshot = jsonb_build_object('withdrawn_at', now()) where id = p.id;
  perform private.emit_event(p.business_id, 'finance.withdrawn', 'evidence_package', p.id, '{}');
end $$;

create function public.create_financial_product(
  p_program_id uuid, p_name text, p_product_type text, p_currency text, p_min bigint, p_max bigint,
  p_eligibility jsonb, p_description text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  fid uuid;
begin
  if not exists (select 1 from public.programs where id = p_program_id and kind = 'lender')
     or not private.is_program_member(p_program_id, array['admin']::public.program_role[]) then
    raise exception 'Only admins of a lender program can list products' using errcode = '42501';
  end if;
  insert into public.financial_products (program_id, name, product_type, currency, min_amount_minor, max_amount_minor, eligibility, description)
  values (p_program_id, p_name, p_product_type, upper(p_currency), p_min, p_max, coalesce(p_eligibility, '{}'), p_description)
  returning id into fid;
  return fid;
end $$;

revoke execute on function public.product_eligibility(uuid, uuid), public.submit_evidence_package(uuid, uuid, text[], bigint, text, boolean),
  public.decide_evidence_package(uuid, public.package_status, text, bigint), public.withdraw_evidence_package(uuid),
  public.create_financial_product(uuid, text, text, text, bigint, bigint, jsonb, text) from public, anon;
grant execute on function public.product_eligibility(uuid, uuid), public.submit_evidence_package(uuid, uuid, text[], bigint, text, boolean),
  public.decide_evidence_package(uuid, public.package_status, text, bigint), public.withdraw_evidence_package(uuid),
  public.create_financial_product(uuid, text, text, text, bigint, bigint, jsonb, text) to authenticated;

alter table public.financial_products enable row level security;
alter table public.evidence_packages enable row level security;
create policy "products: listed" on public.financial_products for select to authenticated
  using (status = 'active' or private.is_program_member(program_id, array['admin']::public.program_role[]));
create policy "packages: owner side" on public.evidence_packages for select to authenticated using (private.is_member(business_id));
-- The partner sees only the package, only while it is live, never the business's own tables.
create policy "packages: partner side" on public.evidence_packages for select to authenticated
  using (private.is_program_member(program_id, array['admin']::public.program_role[]) and status <> 'withdrawn' and expires_at > now());
revoke insert, update, delete on public.financial_products, public.evidence_packages from authenticated;
