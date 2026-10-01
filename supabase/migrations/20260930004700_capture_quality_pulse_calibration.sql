-- B54 Real capture + data quality and B55 Pulse field calibration (deltas over B5 capture/drafts,
-- B25 data quality, B7 Pulse, B38 intelligence quality). Record maturity is measured, never forced:
-- R0 nothing recorded · R1 some records · R2 records on ≥4 days in the last 30 · R3 regular and backed
-- by proof (document-backed or better, an active attestation, or a verified outcome).
-- Pulse usefulness comes only from owner/operator feedback (B11 pulse_feedback); a signal without feedback is UNKNOWN.

-- ─── B54: record maturity ─────────────────────────────────────────────────────
create function private.record_maturity(p_business_id uuid) returns text
language sql stable security definer set search_path = '' as $$
  with ev as (select occurred_at from public.events where business_id = p_business_id and type in ('sale.recorded', 'expense.recorded', 'pack.recorded')),
       days30 as (select count(distinct occurred_at::date) n from ev where occurred_at > now() - interval '30 days')
  select case
    when not exists (select 1 from ev) then 'R0'
    when (select n from days30) < 4 then 'R1'
    when exists (select 1 from public.sales s where s.business_id = p_business_id and s.voided_at is null and s.provenance <> 'self_reported' and s.occurred_at > now() - interval '90 days')
      or exists (select 1 from public.expenses x where x.business_id = p_business_id and x.voided_at is null and x.provenance <> 'self_reported' and x.occurred_at > now() - interval '90 days')
      or exists (select 1 from public.attestations a where a.business_id = p_business_id and a.status = 'active' and a.result in ('confirmed', 'partially_confirmed'))
      or exists (select 1 from public.outcomes o where o.business_id = p_business_id and o.status = 'verified') then 'R3'
    else 'R2' end;
$$;

create table public.record_maturity_snapshots (
  business_id  uuid not null references public.businesses (id) on delete cascade,
  day          date not null,
  level        text not null check (level in ('R0', 'R1', 'R2', 'R3')),
  primary key (business_id, day)
);

-- Daily for every business in an active or completed pilot (progression = first vs latest snapshot).
create function public.snapshot_record_maturity() returns int
language plpgsql security definer set search_path = '' as $$
declare
  n int;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not private.is_platform_admin() then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
  insert into public.record_maturity_snapshots (business_id, day, level)
  select distinct pb.business_id, current_date, private.record_maturity(pb.business_id)
  from public.pilot_businesses pb join public.pilots p on p.id = pb.pilot_id
  where p.status in ('active', 'completed') and pb.eligible
  on conflict (business_id, day) do update set level = excluded.level;
  get diagnostics n = row_count;
  return n;
end $$;

-- Capture channels and quality for a set of businesses. IMPORT and CONNECT have no rail yet → N/A.
create function private.capture_quality(p_business_ids uuid[], p_operators uuid[]) returns jsonb
language sql stable security definer set search_path = '' as $$
  with c as (select * from public.captures where business_id = any (p_business_ids)),
       d as (select d.*, c.channel from public.record_drafts d join c on c.id = d.capture_id),
       recs as (select source_draft_id, created_by from public.sales where business_id = any (p_business_ids) and voided_at is null
                union all select source_draft_id, created_by from public.expenses where business_id = any (p_business_ids) and voided_at is null)
  select jsonb_build_object(
    'channels', jsonb_build_object(
      'TYPE',   (select jsonb_build_object('attempts', count(*), 'extracted', count(*) filter (where status in ('drafted', 'resolved')), 'failed', count(*) filter (where status = 'failed')) from c where channel = 'text'),
      'SPEAK',  (select jsonb_build_object('attempts', count(*), 'extracted', count(*) filter (where status in ('drafted', 'resolved')), 'failed', count(*) filter (where status = 'failed')) from c where channel = 'voice'),
      'PHOTO',  (select jsonb_build_object('attempts', count(*), 'extracted', count(*) filter (where status in ('drafted', 'resolved')), 'failed', count(*) filter (where status = 'failed')) from c where channel = 'photo'),
      'UPLOAD', (select jsonb_build_object('attempts', count(*), 'extracted', count(*) filter (where status in ('drafted', 'resolved')), 'failed', count(*) filter (where status = 'failed')) from c where channel = 'forward'),
      'MANUAL', jsonb_build_object('records', (select count(*) from recs where source_draft_id is null and not (created_by = any (coalesce(p_operators, '{}'))))),
      'OPERATOR_ASSIST', jsonb_build_object('records', (select count(*) from recs where created_by = any (coalesce(p_operators, '{}')))),
      'IMPORT', 'N/A', 'CONNECT', 'N/A'),
    'extraction_success_rate', round((select count(*) filter (where status in ('drafted', 'resolved'))::numeric / nullif(count(*) filter (where status in ('drafted', 'resolved', 'failed')), 0) from c), 4),
    'drafts', (select count(*) from d),
    'confirmed', (select count(*) from d where status = 'confirmed'),
    'rejected', (select count(*) from d where status = 'rejected'),
    'confirmation_rate', round((select count(*) filter (where status = 'confirmed')::numeric / nullif(count(*) filter (where status <> 'proposed'), 0) from d), 4),
    'corrections', (select count(*) from public.record_corrections where business_id = any (p_business_ids)),
    'verified_records', (select count(*) from public.sales where business_id = any (p_business_ids) and provenance in ('third_party_verified', 'institution_verified'))
                      + (select count(*) from public.expenses where business_id = any (p_business_ids) and provenance in ('third_party_verified', 'institution_verified')),
    'issues', (select coalesce(jsonb_object_agg(kind, n), '{}') from (select kind, count(*) n from public.data_quality_issues where business_id = any (p_business_ids) group by 1) x),
    'open_issues', (select count(*) from public.data_quality_issues where business_id = any (p_business_ids) and status = 'open'));
$$;

-- ─── B55: Pulse feedback (extends B11 pulse_feedback; no second feedback model) ───
-- accurate = useful signal · inaccurate = false positive · unclear = not useful · missed = false negative
-- (a problem Pulse did not flag). Operators rate on behalf of their portfolio; action and result are kept.
alter table public.pulse_feedback drop constraint pulse_feedback_verdict_check;
alter table public.pulse_feedback add constraint pulse_feedback_verdict_check check (verdict in ('accurate', 'inaccurate', 'unclear', 'missed'));
alter table public.pulse_feedback alter column user_role drop not null;
alter table public.pulse_feedback
  add column given_as text not null default 'business' check (given_as in ('business', 'operator')),
  add column action_taken text check (char_length(action_taken) <= 300),
  add column result text check (char_length(result) <= 300);

create function public.give_operator_pulse_feedback(p_business_id uuid, p_dimension text, p_computed_on date, p_verdict text,
  p_action_taken text default null, p_result text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.pilot_businesses pb join public.pilot_operators o on o.pilot_id = pb.pilot_id
                 where pb.business_id = p_business_id and o.user_id = auth.uid() and o.role = 'operator') then
    raise exception 'Only this business''s pilot operator can rate its Pulse' using errcode = '42501';
  end if;
  insert into public.pulse_feedback (business_id, dimension, computed_on, verdict, user_role, given_as, action_taken, result)
  values (p_business_id, p_dimension, p_computed_on, p_verdict, null, 'operator', nullif(trim(p_action_taken), ''), nullif(trim(p_result), ''))
  on conflict (business_id, dimension, computed_on, user_id) do update
    set verdict = excluded.verdict, action_taken = excluded.action_taken, result = excluded.result, created_at = now();
end $$;

-- Per dimension: material signals (watch/at_risk), how many were rated, usefulness, false positives and
-- reported misses. Unrated signals stay unknown; nothing is inferred.
create function private.pulse_calibration(p_business_ids uuid[]) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('dimension', dim, 'material_signals', sig, 'rated', rated, 'useful', useful, 'false_positive', fp, 'missed', missed,
           'useful_rate', case when rated > 0 then round(useful::numeric / rated, 4) end,
           'false_positive_rate', case when rated > 0 then round(fp::numeric / rated, 4) end,
           'unrated', greatest(sig - rated, 0)) order by dim), '[]')
  from (select d.dim,
          (select count(*) from public.pulse_snapshots s where s.business_id = any (p_business_ids) and s.dimension = d.dim and s.state in ('watch', 'at_risk')) sig,
          (select count(*) from public.pulse_feedback f where f.business_id = any (p_business_ids) and f.dimension = d.dim and f.verdict <> 'missed') rated,
          (select count(*) from public.pulse_feedback f where f.business_id = any (p_business_ids) and f.dimension = d.dim and f.verdict = 'accurate') useful,
          (select count(*) from public.pulse_feedback f where f.business_id = any (p_business_ids) and f.dimension = d.dim and f.verdict = 'inaccurate') fp,
          (select count(*) from public.pulse_feedback f where f.business_id = any (p_business_ids) and f.dimension = d.dim and f.verdict = 'missed') missed
        from (select distinct dimension dim from public.pulse_snapshots where business_id = any (p_business_ids)
              union select distinct dimension from public.pulse_feedback where business_id = any (p_business_ids)) d) x;
$$;

-- B16 calibration: a "missed" report is not a rated signal, so it never enters accuracy denominators.
create or replace function public.pulse_calibration(p_days int default 90) returns table (dimension text, feedback int, accurate int, accuracy numeric)
language sql stable security definer set search_path = '' as $$
  select dimension, count(*)::int, count(*) filter (where verdict = 'accurate')::int,
    round(count(*) filter (where verdict = 'accurate')::numeric / nullif(count(*) filter (where verdict not in ('unclear', 'missed')), 0), 3)
  from public.pulse_feedback where created_at > now() - make_interval(days => p_days) and verdict <> 'missed'
  group by dimension order by dimension;
$$;

-- ─── Grants and RLS ───────────────────────────────────────────────────────────
revoke execute on function public.snapshot_record_maturity(), public.give_operator_pulse_feedback(uuid, text, date, text, text, text) from public, anon;
grant execute on function public.snapshot_record_maturity(), public.give_operator_pulse_feedback(uuid, text, date, text, text, text) to authenticated, service_role;

alter table public.record_maturity_snapshots enable row level security;
create policy "maturity: readers" on public.record_maturity_snapshots for select to authenticated using (private.can_read(business_id) or private.is_platform_admin());
create policy "feedback: pilot operators" on public.pulse_feedback for select to authenticated using (
  exists (select 1 from public.pilot_businesses pb where pb.business_id = pulse_feedback.business_id and private.can_see_pilot(pb.pilot_id)));
revoke insert, update, delete on public.record_maturity_snapshots from authenticated, anon;
