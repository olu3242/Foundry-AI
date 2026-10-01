-- B46–B50 Real-world evidence and certification. Software tests prove mechanisms; they can never
-- prove the business. This layer only ever reads REAL businesses (B45 data_class), keeps an evidence
-- register that refuses test data, and certifies each claim as PROVEN / PARTIALLY PROVEN /
-- INSUFFICIENT EVIDENCE / FAILED against configurable thresholds. Technical status is reported
-- separately and never upgrades a real-world claim.

-- ─── Evidence register ────────────────────────────────────────────────────────
create table public.evidence_register (
  evidence_id         text primary key,
  business_id         uuid references public.businesses (id) on delete cascade,
  batch               text not null check (batch in ('B46', 'B47', 'B48', 'B49')),
  claim               text not null check (char_length(claim) between 5 and 500),
  source              text not null unique,                    -- e.g. outcome:<id>, attestation:<id>, payment:<id>, document:<ref>
  date                date not null,
  verification_state  text not null check (verification_state in ('observed', 'operator_verified', 'partner_verified', 'third_party_verified', 'rejected')),
  consent_scope       text not null,
  outcome             text,
  confidence          text not null check (confidence in ('low', 'medium', 'high')),
  origin              text not null default 'harvested' check (origin in ('harvested', 'manual')),
  rejected_reason     text,
  recorded_by         uuid references public.profiles (id),
  created_at          timestamptz not null default now(),
  check (business_id is not null or batch = 'B49')               -- only commercial/distribution evidence may be cohort-level
);
create index evidence_register_business_idx on public.evidence_register (business_id);
create index evidence_register_batch_idx on public.evidence_register (batch, verification_state);
create trigger evidence_register_audit after insert or update on public.evidence_register for each row execute function private.audit_row();

-- The register refuses test data and anything without consent, whoever writes it.
create function private.guard_evidence() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.business_id is not null then
    if not private.is_real(new.business_id) then
      raise exception 'Test or demo data can never be evidence' using errcode = 'P0001';
    end if;
    if not exists (select 1 from public.program_enrollments where business_id = new.business_id and status = 'active' and consented_at is not null)
       and not exists (select 1 from public.businesses where id = new.business_id and data_sharing = 'network') then
      raise exception 'No consent covers using this business as evidence' using errcode = 'P0001';
    end if;
  elsif private.environment() <> 'production' then
    raise exception 'Cohort-level evidence can only be recorded in production' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger evidence_register_guard before insert or update of business_id on public.evidence_register for each row execute function private.guard_evidence();

create function private.consent_scope(p_business_id uuid) returns text
language sql stable security definer set search_path = '' as $$
  select concat_ws(', ',
    (select 'program:' || string_agg(p.name, '|') from public.program_enrollments e join public.programs p on p.id = e.program_id
     where e.business_id = p_business_id and e.status = 'active' and e.consented_at is not null),
    (select 'network_learning' from public.businesses where id = p_business_id and data_sharing = 'network'));
$$;

create function private.consented_real(p_business_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_real(p_business_id) and private.consent_scope(p_business_id) <> '';
$$;

-- Daily: harvest evidence from system-of-record rows of real, consenting businesses. Idempotent per source.
create function public.harvest_evidence() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  n int := 0;
  k int;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not private.is_platform_admin() then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;

  -- B46 activation: a real business reached 'activated' in a pilot.
  insert into public.evidence_register (evidence_id, business_id, batch, claim, source, date, verification_state, consent_scope, outcome, confidence)
  select 'EV-B46-' || left(md5('pilot:' || pb.pilot_id || ':' || pb.business_id), 10), pb.business_id, 'B46',
    format('Activated in pilot %s (stage %s)', p.name, pb.stage), 'pilot_activation:' || pb.pilot_id || ':' || pb.business_id,
    coalesce((select (e ->> 'at')::date from jsonb_array_elements(pb.history) e where e ->> 'stage' = 'activated' limit 1), pb.stage_changed_at::date),
    'observed', private.consent_scope(pb.business_id), pb.stage, 'medium'
  from public.pilot_businesses pb join public.pilots p on p.id = pb.pilot_id
  where pb.eligible and private.stage_rank(pb.stage) >= 2 and private.consented_real(pb.business_id)
  on conflict (source) do nothing;
  get diagnostics k = row_count; n := n + k;

  -- B47 outcomes: measured results of interventions (verified ones carry partner verification).
  insert into public.evidence_register (evidence_id, business_id, batch, claim, source, date, verification_state, consent_scope, outcome, confidence)
  select 'EV-B47-' || left(md5('outcome:' || o.id), 10), o.business_id, 'B47',
    format('%s: %s moved from %s to %s after "%s"', case when o.improved then 'Improved' else 'Not improved' end, o.metric, o.baseline_value, o.observed_value, i.title),
    'outcome:' || o.id, o.window_end::date, case when o.status = 'verified' then 'partner_verified' else 'observed' end,
    private.consent_scope(o.business_id), case when o.improved then 'improved' else 'not_improved' end,
    case when o.status = 'verified' then 'high' else 'low' end
  from public.outcomes o join public.interventions i on i.id = o.intervention_id
  where private.consented_real(o.business_id)
  on conflict (source) do update set verification_state = excluded.verification_state, confidence = excluded.confidence
    where public.evidence_register.verification_state <> 'rejected';
  get diagnostics k = row_count; n := n + k;

  -- B48 trust: third-party attestations about real businesses.
  insert into public.evidence_register (evidence_id, business_id, batch, claim, source, date, verification_state, consent_scope, outcome, confidence)
  select 'EV-B48-' || left(md5('attestation:' || a.id), 10), a.business_id, 'B48',
    format('%s %s by %s (%s)', a.claim_type, replace(a.result, '_', ' '), v.name, replace(a.method, '_', ' ')), 'attestation:' || a.id, a.attested_at::date,
    case when a.status in ('active', 'corrected') then 'third_party_verified' else 'rejected' end, private.consent_scope(a.business_id), a.result,
    case when a.result = 'confirmed' and a.status = 'active' then 'high' when a.status = 'active' then 'medium' else 'low' end
  from public.attestations a join public.verifiers v on v.id = a.verifier_id
  where private.consented_real(a.business_id)
  on conflict (source) do update set verification_state = excluded.verification_state, confidence = excluded.confidence, outcome = excluded.outcome;
  get diagnostics k = row_count; n := n + k;

  -- B49 commercial: provider-confirmed payments by real businesses.
  insert into public.evidence_register (evidence_id, business_id, batch, claim, source, date, verification_state, consent_scope, outcome, confidence)
  select 'EV-B49-' || left(md5('payment:' || pr.id), 10), pr.business_id, 'B49',
    format('Paid %s %s by %s for "%s"', pr.paid_amount_minor, pr.paid_currency, coalesce(replace(pr.payment_channel, '_', ' '), 'online payment'), b.description),
    'payment:' || pr.id, pr.paid_at::date, 'third_party_verified', private.consent_scope(pr.business_id), pr.status, 'high'
  from public.payment_requests pr join public.billable_events b on b.id = pr.billable_event_id
  where pr.status in ('succeeded', 'partially_refunded', 'refunded') and private.consented_real(pr.business_id)
  on conflict (source) do update set outcome = excluded.outcome;
  get diagnostics k = row_count; n := n + k;

  -- B49 distribution: how real businesses arrived.
  insert into public.evidence_register (evidence_id, business_id, batch, claim, source, date, verification_state, consent_scope, outcome, confidence)
  select 'EV-B49-' || left(md5('acquisition:' || a.business_id), 10), a.business_id, 'B49',
    format('Acquired via %s%s', replace(a.channel, '_', ' '), coalesce(' (' || p.name || ')', '')), 'acquisition:' || a.business_id, a.attributed_at::date,
    'observed', private.consent_scope(a.business_id), a.channel, 'medium'
  from public.acquisition_attributions a left join public.programs p on p.id = a.program_id
  where private.consented_real(a.business_id)
  on conflict (source) do nothing;
  get diagnostics k = row_count; n := n + k;
  return jsonb_build_object('upserted', n);
end $$;

-- External evidence (e.g. a sponsor's signed agreement, a lender's credit decision letter), entered by an admin.
create function public.register_evidence(p_business_id uuid, p_batch text, p_claim text, p_source text, p_date date,
  p_verification_state text, p_outcome text, p_confidence text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  eid text := 'EV-' || p_batch || '-' || left(md5('manual:' || p_source), 10);
begin
  if not private.is_platform_admin() then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
  if p_source !~ '^(document|contract|letter|statement|registry):.{3,}' then
    raise exception 'Cite the source document (document:, contract:, letter:, statement: or registry:)' using errcode = '22023';
  end if;
  if p_date > current_date then
    raise exception 'Evidence cannot be dated in the future' using errcode = '22023';
  end if;
  insert into public.evidence_register (evidence_id, business_id, batch, claim, source, date, verification_state, consent_scope, outcome, confidence, origin, recorded_by)
  values (eid, p_business_id, p_batch, p_claim, p_source, p_date, p_verification_state,
          coalesce(nullif(private.consent_scope(p_business_id), ''), 'cohort_level'), p_outcome, p_confidence, 'manual', auth.uid());
  return eid;
end $$;

create function public.reject_evidence(p_evidence_id text, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_platform_admin() then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
  update public.evidence_register set verification_state = 'rejected', rejected_reason = left(trim(p_reason), 300), confidence = 'low' where evidence_id = p_evidence_id;
end $$;

-- ─── Real-world measures (real businesses only) ───────────────────────────────
insert into public.platform_settings (key, value) values ('certification_thresholds', '{
  "activation":     {"min_n": 20, "proven": 0.5, "failed": 0.2, "activated_records": 3},
  "outcomes":       {"min_n": 10, "proven": 0.5, "failed": 0.2},
  "trust":          {"min_n": 10, "proven": 0.9, "failed": 0.7, "min_businesses": 5},
  "commercial":     {"min_n": 10, "proven": 0.7, "failed": 0.3},
  "distribution":   {"min_n": 20, "proven": 0.3, "failed": 0.0},
  "unit_economics": {"min_n": 10, "proven": 0.0, "failed": -0.5},
  "data_moat":      {"min_n": 30, "proven": 30, "failed": -1}
}') on conflict (key) do nothing;

create function private.cert_status(p_n numeric, p_value numeric, p_t jsonb) returns text
language sql immutable set search_path = '' as $$
  select case
    when coalesce(p_n, 0) = 0 or p_value is null then 'INSUFFICIENT EVIDENCE'
    when p_n < (p_t ->> 'min_n')::numeric then case when p_value >= (p_t ->> 'proven')::numeric then 'PARTIALLY PROVEN' else 'INSUFFICIENT EVIDENCE' end
    when p_value >= (p_t ->> 'proven')::numeric then 'PROVEN'
    when p_value < (p_t ->> 'failed')::numeric then 'FAILED'
    else 'PARTIALLY PROVEN' end;
$$;

create function public.real_world_evidence() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  t jsonb := (select value from public.platform_settings where key = 'certification_thresholds');
  fx jsonb;
  real_n int;
  act jsonb; outc jsonb; tr jsonb; com jsonb; dist jsonb; ue jsonb; moat jsonb;
  ai_usd numeric; alloc_usd numeric; rev_usd numeric; all_active int; real_active int;
begin
  if not private.is_platform_admin() then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
  fx := public.fx_status();
  select count(*) into real_n from public.businesses where data_class = 'real' and archived_at is null;

  -- B46 activation: real businesses with enough records to be "activated".
  select jsonb_build_object('n', count(*), 'activated', count(*) filter (where recs >= (t -> 'activation' ->> 'activated_records')::int),
      'value', round(avg(case when recs >= (t -> 'activation' ->> 'activated_records')::int then 1 else 0 end), 4),
      'recording_last_14d', count(*) filter (where days14 >= 4),
      'active_last_30d', count(*) filter (where last_act > now() - interval '30 days'),
      'in_pilots', (select count(distinct pb.business_id) from public.pilot_businesses pb join public.businesses b on b.id = pb.business_id where b.data_class = 'real' and pb.eligible))
  into act
  from (select b.id,
          (select count(*) from public.events e where e.business_id = b.id and e.type in ('sale.recorded', 'expense.recorded', 'pack.recorded')) recs,
          (select count(distinct e.occurred_at::date) from public.events e where e.business_id = b.id and e.type in ('sale.recorded', 'expense.recorded', 'pack.recorded') and e.occurred_at > now() - interval '14 days') days14,
          (select max(e.occurred_at) from public.events e where e.business_id = b.id and e.actor_type = 'user') last_act
        from public.businesses b where b.data_class = 'real' and b.archived_at is null) x;

  -- B47 outcomes: verified results only (observed ones are reported, never counted as proof).
  select jsonb_build_object('n', count(*) filter (where o.status = 'verified'), 'value', round(avg(case when o.improved then 1 else 0 end) filter (where o.status = 'verified'), 4),
      'measured', count(*), 'verified_improved', count(*) filter (where o.status = 'verified' and o.improved),
      'interventions', (select count(*) from public.interventions i join public.businesses b on b.id = i.business_id where b.data_class = 'real'),
      'businesses_with_verified_outcome', count(distinct o.business_id) filter (where o.status = 'verified'))
  into outc from public.outcomes o join public.businesses b on b.id = o.business_id where b.data_class = 'real';

  -- B48 trust: third-party attestations and how they hold up; Passport reach.
  select jsonb_build_object('n', count(*), 'value', round(1 - coalesce((select count(*) from public.attestation_disputes d join public.businesses b on b.id = d.business_id
                 where b.data_class = 'real' and d.status = 'upheld')::numeric / nullif(count(*), 0), 0), 4),
      'businesses', count(distinct a.business_id), 'verifiers', count(distinct a.verifier_id),
      'confirmed', count(*) filter (where a.result = 'confirmed'),
      'disputes', (select count(*) from public.attestation_disputes d join public.businesses b on b.id = d.business_id where b.data_class = 'real'),
      'passport_shares', (select count(*) from public.passport_shares s join public.businesses b on b.id = s.business_id where b.data_class = 'real'),
      'passport_views', (select count(*) from public.passport_views v join public.businesses b on b.id = v.business_id where b.data_class = 'real'))
  into tr from public.attestations a join public.businesses b on b.id = a.business_id where b.data_class = 'real';
  if (tr ->> 'businesses')::int < (t -> 'trust' ->> 'min_businesses')::int then
    tr := tr || jsonb_build_object('note', 'fewer businesses than the configured minimum');
  end if;

  -- B49 commercial: provider-confirmed collection from real businesses (native currency; USD only if reportable).
  select jsonb_build_object('n', count(distinct pr.business_id) filter (where pr.status in ('succeeded', 'partially_refunded', 'refunded')),
      'value', round((count(*) filter (where pr.status in ('succeeded', 'partially_refunded', 'refunded')))::numeric
                     / nullif(count(*) filter (where pr.status not in ('created', 'pending')), 0), 4),
      'attempts', count(*), 'held', count(*) filter (where pr.status in ('mismatch', 'duplicate', 'disputed')),
      'collected_native', (select coalesce(jsonb_object_agg(currency, amt), '{}') from (select r.currency, sum(r.amount_minor) amt from public.revenue_events r
                           join public.businesses b on b.id = r.business_id where b.data_class = 'real' group by 1) x),
      'sponsor_paid_charges', (select count(*) from public.billable_events be join public.businesses b on b.id = be.business_id
                               where b.data_class = 'real' and be.payer_kind = 'program' and be.status = 'paid'))
  into com from public.payment_requests pr join public.businesses b on b.id = pr.business_id where b.data_class = 'real';

  select jsonb_build_object('n', count(*), 'value', round(avg(case when a.channel <> 'organic' then 1 else 0 end), 4),
      'by_channel', (select coalesce(jsonb_object_agg(channel, c), '{}') from (select a2.channel, count(*) c from public.acquisition_attributions a2
                     join public.businesses b2 on b2.id = a2.business_id where b2.data_class = 'real' group by 1) y))
  into dist from public.acquisition_attributions a join public.businesses b on b.id = a.business_id where b.data_class = 'real';

  -- Unit economics: USD snapshot revenue − AI cost − allocated cost, for real businesses, last 90 days.
  select coalesce(sum(r.usd_minor), 0) / 100.0 into rev_usd from public.revenue_events r join public.businesses b on b.id = r.business_id
  where b.data_class = 'real' and r.occurred_at > now() - interval '90 days' and r.fx_placeholder is false;
  select coalesce(sum((coalesce(ar.input_tokens, 0) * p.usd_per_mtok_in + coalesce(ar.output_tokens, 0) * p.usd_per_mtok_out) / 1e6), 0) into ai_usd
  from public.agent_runs ar join public.businesses b on b.id = ar.business_id left join public.ai_prices p on p.model = ar.model
  where b.data_class = 'real' and ar.created_at > now() - interval '90 days';
  select count(distinct business_id) filter (where true), count(distinct business_id) filter (where private.is_real(business_id))
  into all_active, real_active from public.events where occurred_at > now() - interval '90 days' and actor_type = 'user';
  select coalesce(sum(amount_usd), 0) * coalesce(real_active::numeric / nullif(all_active, 0), 0) into alloc_usd
  from public.cost_inputs where month > (now() - interval '90 days')::date;
  ue := jsonb_build_object('n', (com ->> 'n')::int, 'revenue_usd_90d', round(rev_usd, 2), 'ai_cost_usd_90d', round(ai_usd, 2), 'allocated_cost_usd_90d', round(alloc_usd, 2),
    'contribution_usd_90d', round(rev_usd - ai_usd - alloc_usd, 2), 'real_active_businesses', real_active,
    'contribution_per_active_business_usd', case when real_active > 0 then round((rev_usd - ai_usd - alloc_usd) / real_active, 2) end,
    'usd_reportable', (fx ->> 'usd_reportable')::boolean,
    'value', case when (fx ->> 'usd_reportable')::boolean and rev_usd > 0 then round((rev_usd - ai_usd - alloc_usd) / rev_usd, 4) end);

  -- Data moat: complete chains decision → intervention → verified outcome in consenting real businesses.
  select jsonb_build_object('n', count(*), 'value', count(*),
      'consenting_real_businesses', (select count(*) from public.businesses where data_class = 'real' and data_sharing = 'network'))
  into moat from public.decisions d join public.outcomes o on o.intervention_id = d.intervention_id join public.businesses b on b.id = d.business_id
  where b.data_class = 'real' and b.data_sharing = 'network' and o.status = 'verified';

  return jsonb_build_object('real_businesses', real_n, 'test_businesses', (select count(*) from public.businesses where data_class = 'test'),
    'environment', private.environment(), 'fx', jsonb_build_object('usd_reportable', fx -> 'usd_reportable'), 'thresholds', t,
    'activation', act, 'outcomes', outc, 'trust', tr, 'commercial', com, 'distribution', dist, 'unit_economics', ue, 'data_moat', moat,
    'register', (select coalesce(jsonb_object_agg(batch, x), '{}') from (select batch, jsonb_object_agg(verification_state, c) x from
                 (select batch, verification_state, count(*) c from public.evidence_register group by 1, 2) y group by 1) z));
end $$;

-- ─── B50 certification ────────────────────────────────────────────────────────
create table public.real_world_certifications (
  id          uuid primary key default gen_random_uuid(),
  taken_at    timestamptz not null default now(),
  taken_by    uuid references public.profiles (id),
  technical   text not null,
  overall     text not null check (overall in ('PROVEN', 'PARTIALLY PROVEN', 'INSUFFICIENT EVIDENCE', 'FAILED')),
  result      jsonb not null
);

create function public.real_world_certification() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  e jsonb;
  t jsonb;
  claims jsonb := '[]';
  k text;
  st text;
  statuses text[] := '{}';
  overall text;
  sec jsonb;
  integ jsonb;
  technical text;
begin
  if not private.is_platform_admin() then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
  e := public.real_world_evidence();
  t := e -> 'thresholds';
  foreach k in array array['activation', 'outcomes', 'trust', 'commercial', 'distribution', 'unit_economics', 'data_moat'] loop
    st := private.cert_status((e -> k ->> 'n')::numeric, (e -> k ->> 'value')::numeric, t -> k);
    if k = 'trust' and st = 'PROVEN' and (e -> k ->> 'businesses')::int < (t -> k ->> 'min_businesses')::int then
      st := 'PARTIALLY PROVEN';
    end if;
    if k = 'unit_economics' and not coalesce((e -> k ->> 'usd_reportable')::boolean, false) then
      st := 'INSUFFICIENT EVIDENCE';                               -- never certify money on placeholder or stale FX
    end if;
    statuses := statuses || st;
    claims := claims || jsonb_build_object('claim', k, 'status', st, 'n', e -> k -> 'n', 'value', e -> k -> 'value', 'threshold', t -> k);
  end loop;
  overall := case
    when 'FAILED' = any (statuses) then 'FAILED'
    when statuses <@ array['PROVEN'] then 'PROVEN'
    when statuses <@ array['INSUFFICIENT EVIDENCE'] then 'INSUFFICIENT EVIDENCE'
    else 'PARTIALLY PROVEN' end;
  sec := public.security_report();
  integ := public.integrity_report();
  technical := case when exists (select 1 from jsonb_each(sec) x(sk, sv) where jsonb_typeof(sv) = 'array' and jsonb_array_length(sv) > 0)
                      or exists (select 1 from jsonb_each_text(integ) x(ik, iv) where ik not in ('dead_jobs_7d', 'negative_stock_products') and iv ~ '^\d+$' and iv::int > 0)
                    then 'FAIL' else 'PASS' end;
  return jsonb_build_object('overall', overall, 'technical', technical,
    'note', 'Technical status never changes a real-world claim. Only real businesses (production environment) count.',
    'real_businesses', e -> 'real_businesses', 'test_businesses_excluded', e -> 'test_businesses', 'environment', e -> 'environment',
    'claims', claims, 'evidence', e);
end $$;

create function public.certify_real_world() returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  c jsonb;
  cid uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not private.is_platform_admin() then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
  c := public.real_world_certification();
  insert into public.real_world_certifications (taken_by, technical, overall, result) values (auth.uid(), c ->> 'technical', c ->> 'overall', c) returning id into cid;
  return cid;
end $$;

revoke execute on function public.harvest_evidence(), public.register_evidence(uuid, text, text, text, date, text, text, text), public.reject_evidence(text, text),
  public.real_world_evidence(), public.real_world_certification(), public.certify_real_world() from public, anon;
grant execute on function public.harvest_evidence(), public.register_evidence(uuid, text, text, text, date, text, text, text), public.reject_evidence(text, text),
  public.real_world_evidence(), public.real_world_certification(), public.certify_real_world() to authenticated, service_role;

alter table public.evidence_register enable row level security;
alter table public.real_world_certifications enable row level security;
create policy "evidence: admins" on public.evidence_register for select to authenticated using (private.is_platform_admin());
create policy "certifications: admins" on public.real_world_certifications for select to authenticated using (private.is_platform_admin());
revoke insert, update, delete on public.evidence_register, public.real_world_certifications from authenticated, anon;
