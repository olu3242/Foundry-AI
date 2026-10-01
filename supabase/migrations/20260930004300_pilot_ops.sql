-- B45 Pilot operations engine. A pilot is configuration over an existing program (B10 distribution):
-- cohort, eligibility, operators, sponsor, support owner, intervention scope, calendar, escalation,
-- consent version, evidence requirements and success metrics. Nothing is hard-coded (size, length,
-- market, vertical). Stages are computed from live data by a daily worker, so a pilot runs without a
-- developer. Every business carries a data class: only 'real' businesses (created in a production
-- environment) can ever count towards pilot, outcome, commercial or certification evidence.

-- ─── Test vs real data ────────────────────────────────────────────────────────
insert into public.platform_settings (key, value) values ('environment', '"unset"') on conflict (key) do nothing;

alter table public.businesses add column data_class text not null default 'test' check (data_class in ('test', 'real'));
create index businesses_data_class_idx on public.businesses (data_class) where data_class = 'real';

create function private.environment() returns text
language sql stable security definer set search_path = '' as $$
  select coalesce((select value #>> '{}' from public.platform_settings where key = 'environment'), 'unset');
$$;

create function private.classify_business() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- Only a production environment creates real businesses; demos, seeds, staging and tests never do.
  new.data_class := case when private.environment() = 'production' then 'real' else 'test' end;
  return new;
end $$;
create trigger businesses_classify before insert on public.businesses for each row execute function private.classify_business();

create function private.is_real(p_business_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.businesses where id = p_business_id and data_class = 'real');
$$;

-- Admins can demote a business to test (e.g. a staff demo account in production). Promotion to real is
-- possible only in production, so local or staging data can never become evidence.
create function public.set_business_data_class(p_business_id uuid, p_class text, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_platform_admin() then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
  if p_class not in ('test', 'real') or char_length(coalesce(trim(p_reason), '')) < 5 then
    raise exception 'Give the class and a reason' using errcode = '22023';
  end if;
  if p_class = 'real' and private.environment() <> 'production' then
    raise exception 'Only a production environment can hold real businesses' using errcode = 'P0001';
  end if;
  update public.businesses set data_class = p_class where id = p_business_id;
  perform private.emit_event(p_business_id, 'business.data_class_set', 'business', p_business_id, jsonb_build_object('class', p_class, 'reason', trim(p_reason)));
end $$;

-- ─── Pilot configuration ──────────────────────────────────────────────────────
create table public.pilots (
  id                     uuid primary key default gen_random_uuid(),
  name                   text not null check (char_length(name) between 3 and 120),
  program_id             uuid not null references public.programs (id) on delete cascade,
  sponsor_org_id         uuid references public.organizations (id) on delete set null,
  status                 text not null default 'draft' check (status in ('draft', 'active', 'completed', 'cancelled')),
  country_code           text check (country_code ~ '^[A-Z]{2}$'),
  sector                 text,
  pack_key               text,
  target_size            int not null check (target_size between 1 and 100000),
  starts_on              date not null,
  ends_on                date not null,
  support_owner          uuid references public.profiles (id),
  intervention_scope     text[] not null default '{}',            -- solution keys; empty = any plan
  escalation_days        int not null default 7 check (escalation_days between 1 and 60),
  consent_version        text not null default 'v1',
  stage_rules            jsonb not null default '{"activated_records": 3, "recording_days_14": 4, "retained_days": 60}',
  evidence_requirements  jsonb not null default '{"min_verified_outcomes": 1, "min_real_businesses": 1}',
  success_metrics        jsonb not null default '[]',             -- [{key, target}] keys from pilot_metric()
  checkpoints            jsonb not null default '[]',             -- [{day, label}]
  created_by             uuid not null default auth.uid() references public.profiles (id),
  created_at             timestamptz not null default now(),
  check (ends_on > starts_on)
);
create index pilots_program_idx on public.pilots (program_id);
create trigger pilots_audit after insert or update on public.pilots for each row execute function private.audit_row();

create table public.pilot_operators (
  pilot_id  uuid not null references public.pilots (id) on delete cascade,
  user_id   uuid not null references public.profiles (id) on delete cascade,
  role      text not null check (role in ('operator', 'sponsor', 'support')),
  primary key (pilot_id, user_id, role)
);
create index pilot_operators_user_idx on public.pilot_operators (user_id);

create table public.pilot_invites (
  id           uuid primary key default gen_random_uuid(),
  pilot_id     uuid not null references public.pilots (id) on delete cascade,
  phone        text not null check (phone ~ '^[0-9]{8,15}$'),
  invited_by   uuid references public.profiles (id),
  invited_at   timestamptz not null default now(),
  business_id  uuid references public.businesses (id) on delete set null,
  accepted_at  timestamptz,
  unique (pilot_id, phone)
);
create index pilot_invites_business_idx on public.pilot_invites (business_id);

create table public.pilot_businesses (
  pilot_id           uuid not null references public.pilots (id) on delete cascade,
  business_id        uuid not null references public.businesses (id) on delete cascade,
  stage              text not null default 'onboarded' check (stage in ('onboarded', 'activated', 'recording', 'diagnosed', 'intervention', 'outcome', 'retained')),
  eligible           boolean not null default true,
  ineligible_reason  text,
  consent_version    text,
  joined_at          timestamptz not null default now(),
  stage_changed_at   timestamptz not null default now(),
  last_activity_at   timestamptz,
  at_risk            boolean not null default false,
  failure_reason     text,
  history            jsonb not null default '[]',
  primary key (pilot_id, business_id)
);
create index pilot_businesses_business_idx on public.pilot_businesses (business_id);
create trigger pilot_businesses_audit after update of stage, failure_reason on public.pilot_businesses for each row execute function private.audit_row();

create function private.can_see_pilot(p_pilot_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_platform_admin()
    or exists (select 1 from public.pilot_operators where pilot_id = p_pilot_id and user_id = (select auth.uid()))
    or exists (select 1 from public.pilots p where p.id = p_pilot_id and private.is_program_member(p.program_id, array['admin']::public.program_role[]))
    or exists (select 1 from public.pilots p join public.org_members m on m.org_id = p.sponsor_org_id where p.id = p_pilot_id and m.user_id = (select auth.uid()));
$$;

create function public.save_pilot(p_config jsonb) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  pid uuid := nullif(p_config ->> 'id', '')::uuid;
begin
  if not private.is_platform_admin() then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
  if jsonb_typeof(coalesce(p_config -> 'success_metrics', '[]')) <> 'array'
     or exists (select 1 from jsonb_array_elements(coalesce(p_config -> 'success_metrics', '[]')) m
                where not (m ->> 'key' = any (array['activation_rate', 'recording_rate', 'intervention_rate', 'verified_outcomes', 'improved_outcome_rate', 'retention_rate']))
                   or (m ->> 'target') is null) then
    raise exception 'Unknown success metric' using errcode = '22023';
  end if;
  if pid is null then
    insert into public.pilots (name, program_id, sponsor_org_id, country_code, sector, pack_key, target_size, starts_on, ends_on, support_owner,
      intervention_scope, escalation_days, consent_version, stage_rules, evidence_requirements, success_metrics, checkpoints)
    values (p_config ->> 'name', coalesce(nullif(p_config ->> 'program_id', '')::uuid,
        (select id from public.programs where join_code = upper(trim(p_config ->> 'join_code')))), nullif(p_config ->> 'sponsor_org_id', '')::uuid, nullif(p_config ->> 'country_code', ''),
      nullif(p_config ->> 'sector', ''), nullif(p_config ->> 'pack_key', ''), (p_config ->> 'target_size')::int, (p_config ->> 'starts_on')::date,
      (p_config ->> 'ends_on')::date, nullif(p_config ->> 'support_owner', '')::uuid,
      coalesce(array(select jsonb_array_elements_text(p_config -> 'intervention_scope')), '{}'),
      coalesce((p_config ->> 'escalation_days')::int, 7), coalesce(p_config ->> 'consent_version', 'v1'),
      coalesce(p_config -> 'stage_rules', '{"activated_records": 3, "recording_days_14": 4, "retained_days": 60}'),
      coalesce(p_config -> 'evidence_requirements', '{"min_verified_outcomes": 1, "min_real_businesses": 1}'),
      coalesce(p_config -> 'success_metrics', '[]'), coalesce(p_config -> 'checkpoints', '[]'))
    returning id into pid;
  else
    update public.pilots set name = coalesce(p_config ->> 'name', name), status = coalesce(p_config ->> 'status', status),
      target_size = coalesce((p_config ->> 'target_size')::int, target_size), ends_on = coalesce((p_config ->> 'ends_on')::date, ends_on),
      escalation_days = coalesce((p_config ->> 'escalation_days')::int, escalation_days),
      success_metrics = coalesce(p_config -> 'success_metrics', success_metrics), checkpoints = coalesce(p_config -> 'checkpoints', checkpoints)
    where id = pid;
  end if;
  -- The cohort size is the pilot's decision: the program's free pilot seats never cap it.
  update public.programs pr set pilot_seats = greatest(pr.pilot_seats, p.target_size) from public.pilots p where p.id = pid and pr.id = p.program_id;
  return pid;
end $$;

create function public.add_pilot_operator(p_pilot_id uuid, p_contact text, p_role text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid;
begin
  if not private.is_platform_admin() then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
  select id into uid from public.profiles where phone = regexp_replace(p_contact, '\D', '', 'g') or lower(email) = lower(trim(p_contact)) limit 1;
  if uid is null then
    raise exception 'No Foundry account with that phone or email' using errcode = 'P0002';
  end if;
  insert into public.pilot_operators (pilot_id, user_id, role) values (p_pilot_id, uid, p_role) on conflict do nothing;
end $$;

create function public.invite_to_pilot(p_pilot_id uuid, p_phones text[]) returns int
language plpgsql security definer set search_path = '' as $$
declare
  n int;
begin
  if not (private.is_platform_admin() or exists (select 1 from public.pilot_operators where pilot_id = p_pilot_id and user_id = auth.uid() and role in ('operator', 'support'))) then
    raise exception 'Pilot operators only' using errcode = '42501';
  end if;
  insert into public.pilot_invites (pilot_id, phone, invited_by)
  select p_pilot_id, d, auth.uid() from (select distinct regexp_replace(x, '\D', '', 'g') d from unnest(p_phones) x) s where d ~ '^[0-9]{8,15}$'
  on conflict (pilot_id, phone) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

-- ─── Cohort membership: consented program enrollment → pilot, eligibility checked ──
create function private.join_pilots_on_enrollment() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  p public.pilots;
  b public.businesses;
  why text;
begin
  if new.status <> 'active' or new.consented_at is null then
    return new;
  end if;
  select * into b from public.businesses where id = new.business_id;
  for p in select * from public.pilots where program_id = new.program_id and status = 'active' loop
    why := case
      when p.country_code is not null and b.country_code <> p.country_code then 'outside the pilot market'
      when p.sector is not null and coalesce(b.sector, '') <> p.sector then 'different sector'
      when p.pack_key is not null and not exists (select 1 from public.business_packs where business_id = b.id and pack_key = p.pack_key) then 'pack not turned on'
      when (select count(*) from public.pilot_businesses where pilot_id = p.id and eligible) >= p.target_size then 'cohort full'
    end;
    insert into public.pilot_businesses (pilot_id, business_id, eligible, ineligible_reason, consent_version, history)
    values (p.id, b.id, why is null, why, p.consent_version, jsonb_build_array(jsonb_build_object('stage', 'onboarded', 'at', now())))
    on conflict (pilot_id, business_id) do nothing;
    update public.pilot_invites i set business_id = b.id, accepted_at = coalesce(i.accepted_at, now())
    where i.pilot_id = p.id and i.business_id is null
      and i.phone in (select pr.phone from public.memberships m join public.profiles pr on pr.id = m.user_id where m.business_id = b.id and m.role = 'owner');
  end loop;
  return new;
end $$;
create trigger program_enrollments_pilots after insert or update of status, consented_at on public.program_enrollments
  for each row execute function private.join_pilots_on_enrollment();

alter table public.escalations drop constraint escalations_kind_check;
alter table public.escalations add constraint escalations_kind_check check (kind in ('assign_verifier', 'ignored_requests', 'automation_failed', 'pilot_stalled'));

-- ─── Stage engine ─────────────────────────────────────────────────────────────
create function private.pilot_stage(p public.pilots, pb public.pilot_businesses) returns text
language plpgsql stable security definer set search_path = '' as $$
declare
  recs int;
  days14 int;
  last_act timestamptz;
begin
  select count(*), max(occurred_at) into recs, last_act from public.events
  where business_id = pb.business_id and type in ('sale.recorded', 'expense.recorded', 'pack.recorded') and occurred_at >= pb.joined_at - interval '1 day';
  select count(distinct occurred_at::date) into days14 from public.events
  where business_id = pb.business_id and type in ('sale.recorded', 'expense.recorded', 'pack.recorded') and occurred_at > now() - interval '14 days';
  if exists (select 1 from public.outcomes o join public.interventions i on i.id = o.intervention_id
             where o.business_id = pb.business_id and i.started_at >= pb.joined_at - interval '1 day') then
    if pb.joined_at < now() - make_interval(days => coalesce((p.stage_rules ->> 'retained_days')::int, 60)) and last_act > now() - interval '30 days' then
      return 'retained';
    end if;
    return 'outcome';
  end if;
  if exists (select 1 from public.interventions i left join public.solution_versions v on v.id = i.solution_version_id left join public.solutions s on s.id = v.solution_id
             where i.business_id = pb.business_id and i.started_at >= pb.joined_at - interval '1 day'
               and (cardinality(p.intervention_scope) = 0 or s.key = any (p.intervention_scope))) then
    return 'intervention';
  end if;
  if exists (select 1 from public.pulse_snapshots where business_id = pb.business_id and computed_at >= pb.joined_at and state <> 'insufficient_data')
     or exists (select 1 from public.decisions where business_id = pb.business_id and created_at >= pb.joined_at) then
    if recs >= coalesce((p.stage_rules ->> 'activated_records')::int, 3) then
      return 'diagnosed';
    end if;
  end if;
  if days14 >= coalesce((p.stage_rules ->> 'recording_days_14')::int, 4) then
    return 'recording';
  end if;
  if recs >= coalesce((p.stage_rules ->> 'activated_records')::int, 3) then
    return 'activated';
  end if;
  return 'onboarded';
end $$;

create function private.stage_rank(s text) returns int
language sql immutable set search_path = '' as $$
  select array_position(array['onboarded', 'activated', 'recording', 'diagnosed', 'intervention', 'outcome', 'retained'], s);
$$;

-- Daily: advance every active pilot. Stages only move forward (the furthest reached); risk and
-- failure reasons describe where a business is stuck. Stalled businesses escalate to the program.
create function public.advance_pilots() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  p public.pilots;
  pb public.pilot_businesses;
  s text;
  last_act timestamptz;
  moved int := 0;
  escalated int := 0;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not private.is_platform_admin() then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
  update public.pilots set status = 'completed' where status = 'active' and ends_on < current_date;
  for p in select * from public.pilots where status in ('active', 'completed') loop
    for pb in select * from public.pilot_businesses where pilot_id = p.id and eligible loop
      s := private.pilot_stage(p, pb);
      select max(occurred_at) into last_act from public.events where business_id = pb.business_id and actor_type = 'user';
      if private.stage_rank(s) > private.stage_rank(pb.stage) and p.status = 'active' then
        update public.pilot_businesses set stage = s, stage_changed_at = now(), history = history || jsonb_build_object('stage', s, 'at', now())
        where pilot_id = p.id and business_id = pb.business_id;
        perform private.emit_event(pb.business_id, 'pilot.stage_reached', 'pilot', p.id, jsonb_build_object('stage', s));
        moved := moved + 1;
        pb.stage := s;
      end if;
      update public.pilot_businesses set last_activity_at = last_act,
        at_risk = p.status = 'active' and coalesce(last_act, joined_at) < now() - make_interval(days => p.escalation_days),
        failure_reason = case when p.status = 'completed' and private.stage_rank(pb.stage) < private.stage_rank('outcome') then
          coalesce(failure_reason, case pb.stage when 'onboarded' then 'never_activated' when 'activated' then 'stopped_recording'
            when 'recording' then 'not_diagnosed' when 'diagnosed' then 'no_intervention' else 'no_outcome' end) else failure_reason end
      where pilot_id = p.id and business_id = pb.business_id;
      if p.status = 'active' and coalesce(last_act, pb.joined_at) < now() - make_interval(days => p.escalation_days) then
        insert into public.escalations (business_id, program_id, kind, reason, evidence, dedupe_key)
        values (pb.business_id, p.program_id, 'pilot_stalled', format('No activity for %s+ days in pilot %s (stage: %s)', p.escalation_days, p.name, pb.stage),
          jsonb_build_object('pilot_id', p.id, 'stage', pb.stage, 'last_activity_at', last_act), 'pilot:' || p.id || ':' || pb.business_id || ':' || to_char(now(), 'IYYY-IW'))
        on conflict (dedupe_key) do nothing;
        if found then escalated := escalated + 1; end if;
      end if;
    end loop;
  end loop;
  return jsonb_build_object('moved', moved, 'escalated', escalated);
end $$;

-- Operator-recorded reason for a business that left or is stuck (shown next to the computed one).
create function public.set_pilot_failure_reason(p_pilot_id uuid, p_business_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.can_see_pilot(p_pilot_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  update public.pilot_businesses set failure_reason = left(trim(p_reason), 200) where pilot_id = p_pilot_id and business_id = p_business_id;
end $$;

-- ─── Metrics and report (real businesses only count; test businesses shown separately) ──
create function private.pilot_metric(p_pilot_id uuid, p_key text) returns numeric
language plpgsql stable security definer set search_path = '' as $$
declare
  n numeric;
begin
  select count(*) into n from public.pilot_businesses pb join public.businesses b on b.id = pb.business_id
  where pb.pilot_id = p_pilot_id and pb.eligible and b.data_class = 'real';
  if p_key = 'verified_outcomes' then
    return (select count(*) from public.outcomes o join public.pilot_businesses pb on pb.business_id = o.business_id and pb.pilot_id = p_pilot_id
            join public.businesses b on b.id = o.business_id join public.interventions i on i.id = o.intervention_id
            where b.data_class = 'real' and pb.eligible and o.status = 'verified' and i.started_at >= pb.joined_at - interval '1 day');
  end if;
  if n = 0 then
    return null;
  end if;
  return round(case p_key
    when 'activation_rate' then (select count(*) from public.pilot_businesses pb join public.businesses b on b.id = pb.business_id
                                 where pb.pilot_id = p_pilot_id and pb.eligible and b.data_class = 'real' and private.stage_rank(pb.stage) >= 2) / n
    when 'recording_rate' then (select count(*) from public.pilot_businesses pb join public.businesses b on b.id = pb.business_id
                                where pb.pilot_id = p_pilot_id and pb.eligible and b.data_class = 'real' and private.stage_rank(pb.stage) >= 3) / n
    when 'intervention_rate' then (select count(*) from public.pilot_businesses pb join public.businesses b on b.id = pb.business_id
                                   where pb.pilot_id = p_pilot_id and pb.eligible and b.data_class = 'real' and private.stage_rank(pb.stage) >= 5) / n
    when 'retention_rate' then (select count(*) from public.pilot_businesses pb join public.businesses b on b.id = pb.business_id
                                where pb.pilot_id = p_pilot_id and pb.eligible and b.data_class = 'real' and pb.last_activity_at > now() - interval '30 days') / n
    when 'improved_outcome_rate' then (select avg(case when o.improved then 1 else 0 end) from public.outcomes o
                                       join public.pilot_businesses pb on pb.business_id = o.business_id and pb.pilot_id = p_pilot_id
                                       join public.businesses b on b.id = o.business_id where b.data_class = 'real' and o.status = 'verified')
  end, 4);
end $$;

create function public.pilot_report(p_pilot_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  p public.pilots;
begin
  if not private.can_see_pilot(p_pilot_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select * into p from public.pilots where id = p_pilot_id;
  return jsonb_build_object(
    'pilot', to_jsonb(p) || jsonb_build_object('program', (select name from public.programs where id = p.program_id),
      'join_code', (select join_code from public.programs where id = p.program_id),
      'sponsor', (select name from public.organizations where id = p.sponsor_org_id),
      'support_owner', (select coalesce(full_name, email, phone) from public.profiles where id = p.support_owner),
      'day', greatest(0, current_date - p.starts_on), 'length_days', p.ends_on - p.starts_on),
    'operators', (select coalesce(jsonb_agg(jsonb_build_object('name', coalesce(pr.full_name, pr.email, pr.phone), 'role', o.role)), '[]')
                  from public.pilot_operators o join public.profiles pr on pr.id = o.user_id where o.pilot_id = p.id),
    'calendar', (select coalesce(jsonb_agg(jsonb_build_object('day', (c ->> 'day')::int, 'label', c ->> 'label', 'date', p.starts_on + (c ->> 'day')::int,
                   'done', p.starts_on + (c ->> 'day')::int <= current_date) order by (c ->> 'day')::int), '[]') from jsonb_array_elements(p.checkpoints) c),
    'invited', (select count(*) from public.pilot_invites where pilot_id = p.id),
    'invites_accepted', (select count(*) from public.pilot_invites where pilot_id = p.id and accepted_at is not null),
    -- Funnel = businesses that reached at least each stage, split real / test.
    'funnel', (select jsonb_agg(jsonb_build_object('stage', s, 'real', (select count(*) from public.pilot_businesses pb join public.businesses b on b.id = pb.business_id
                  where pb.pilot_id = p.id and pb.eligible and b.data_class = 'real' and private.stage_rank(pb.stage) >= private.stage_rank(s)),
                'test', (select count(*) from public.pilot_businesses pb join public.businesses b on b.id = pb.business_id
                  where pb.pilot_id = p.id and pb.eligible and b.data_class = 'test' and private.stage_rank(pb.stage) >= private.stage_rank(s))) order by private.stage_rank(s))
               from unnest(array['onboarded', 'activated', 'recording', 'diagnosed', 'intervention', 'outcome', 'retained']) s),
    'ineligible', (select coalesce(jsonb_object_agg(ineligible_reason, n), '{}') from (select ineligible_reason, count(*) n from public.pilot_businesses
                   where pilot_id = p.id and not eligible group by 1) x),
    'failure_reasons', (select coalesce(jsonb_object_agg(failure_reason, n), '{}') from (select failure_reason, count(*) n from public.pilot_businesses
                   where pilot_id = p.id and failure_reason is not null group by 1) x),
    'median_days_to_activation', (select percentile_cont(0.5) within group (order by extract(epoch from (h.at - pb.joined_at)) / 86400)
                   from public.pilot_businesses pb cross join lateral (select (e ->> 'at')::timestamptz at from jsonb_array_elements(pb.history) e where e ->> 'stage' = 'activated' limit 1) h
                   join public.businesses b on b.id = pb.business_id where pb.pilot_id = p.id and b.data_class = 'real'),
    'businesses', (select coalesce(jsonb_agg(jsonb_build_object('business_id', b.id, 'name', b.name, 'class', b.data_class, 'stage', pb.stage, 'eligible', pb.eligible,
                   'ineligible_reason', pb.ineligible_reason, 'at_risk', pb.at_risk, 'last_activity_at', pb.last_activity_at, 'failure_reason', pb.failure_reason)
                   order by pb.at_risk desc, private.stage_rank(pb.stage), b.name), '[]')
                   from public.pilot_businesses pb join public.businesses b on b.id = pb.business_id where pb.pilot_id = p.id),
    'success_metrics', (select coalesce(jsonb_agg(jsonb_build_object('key', m ->> 'key', 'target', (m ->> 'target')::numeric,
                   'value', private.pilot_metric(p.id, m ->> 'key'),
                   'met', private.pilot_metric(p.id, m ->> 'key') >= (m ->> 'target')::numeric)), '[]') from jsonb_array_elements(p.success_metrics) m),
    'evidence', jsonb_build_object(
      'real_businesses', (select count(*) from public.pilot_businesses pb join public.businesses b on b.id = pb.business_id where pb.pilot_id = p.id and pb.eligible and b.data_class = 'real'),
      'test_businesses', (select count(*) from public.pilot_businesses pb join public.businesses b on b.id = pb.business_id where pb.pilot_id = p.id and b.data_class = 'test'),
      'verified_outcomes', private.pilot_metric(p.id, 'verified_outcomes'),
      'requirements', p.evidence_requirements,
      'requirements_met', private.pilot_metric(p.id, 'verified_outcomes') >= coalesce((p.evidence_requirements ->> 'min_verified_outcomes')::int, 1)
        and (select count(*) from public.pilot_businesses pb join public.businesses b on b.id = pb.business_id where pb.pilot_id = p.id and pb.eligible and b.data_class = 'real')
            >= coalesce((p.evidence_requirements ->> 'min_real_businesses')::int, 1)));
end $$;

-- ─── Grants and RLS ───────────────────────────────────────────────────────────
revoke execute on function public.set_business_data_class(uuid, text, text), public.save_pilot(jsonb), public.add_pilot_operator(uuid, text, text),
  public.invite_to_pilot(uuid, text[]), public.advance_pilots(), public.set_pilot_failure_reason(uuid, uuid, text), public.pilot_report(uuid) from public, anon;
grant execute on function public.set_business_data_class(uuid, text, text), public.save_pilot(jsonb), public.add_pilot_operator(uuid, text, text),
  public.invite_to_pilot(uuid, text[]), public.advance_pilots(), public.set_pilot_failure_reason(uuid, uuid, text), public.pilot_report(uuid) to authenticated, service_role;
grant execute on function private.can_see_pilot(uuid), private.is_real(uuid) to authenticated;

alter table public.pilots enable row level security;
alter table public.pilot_operators enable row level security;
alter table public.pilot_invites enable row level security;
alter table public.pilot_businesses enable row level security;
create policy "pilots: viewers" on public.pilots for select to authenticated using (private.can_see_pilot(id));
create policy "pilot operators: viewers" on public.pilot_operators for select to authenticated using (private.can_see_pilot(pilot_id));
create policy "pilot invites: viewers" on public.pilot_invites for select to authenticated using (private.can_see_pilot(pilot_id));
create policy "pilot businesses: viewers or owner" on public.pilot_businesses for select to authenticated using (private.can_see_pilot(pilot_id) or private.can_read(business_id));
revoke insert, update, delete on public.pilots, public.pilot_operators, public.pilot_invites, public.pilot_businesses from authenticated, anon;
-- (save_pilot resolves a program by its join code too: platform admins don't read programs directly.)
