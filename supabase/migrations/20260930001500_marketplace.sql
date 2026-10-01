-- B17 Solution marketplace: provider onboarding, solution submission → review → live, pricing
-- metadata, consented provider-led engagements. Partner solutions stay inside the same
-- workflow → approval → evidence → outcome → audit path (B11/B13).

-- Platform-level rows (providers, solutions) are audited too; they have no business.
alter table public.audit_log alter column business_id drop not null;
create policy "audit: platform admins read platform rows" on public.audit_log for select to authenticated
  using (business_id is null and private.is_platform_admin());

create table public.providers (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(name) between 3 and 120),
  kind         text not null check (kind in ('ngo', 'consultant', 'supplier', 'fintech', 'trainer', 'other')),
  contact      text not null check (char_length(contact) between 5 and 200),
  description  text check (char_length(description) <= 2000),
  status       text not null default 'pending' check (status in ('pending', 'approved', 'suspended')),
  created_by   uuid not null default auth.uid() references public.profiles (id),
  created_at   timestamptz not null default now()
);
create table public.provider_members (
  provider_id  uuid not null references public.providers (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  primary key (provider_id, user_id)
);
create trigger providers_audit after insert or update on public.providers for each row execute function private.audit_row();

create function private.is_provider_member(pid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.provider_members where provider_id = pid and user_id = (select auth.uid()));
$$;
grant execute on function private.is_provider_member(uuid) to authenticated;

alter table public.solutions
  add column provider_id uuid references public.providers (id) on delete cascade,
  add column delivery text not null default 'self_serve' check (delivery in ('self_serve', 'provider_led')),
  add column pricing_model text not null default 'free' check (pricing_model in ('free', 'fixed', 'monthly', 'success_fee')),
  add column price_minor bigint check (price_minor >= 0),
  add column currency text check (currency ~ '^[A-Z]{3}$'),
  add column commercial_terms text check (char_length(commercial_terms) <= 1000),
  add column review_note text,
  add column reviewed_by uuid references public.profiles (id),
  add column reviewed_at timestamptz;
create trigger solutions_audit after insert or update on public.solutions for each row execute function private.audit_row();

create table public.solution_engagements (
  id               uuid primary key default gen_random_uuid(),
  intervention_id  uuid not null unique references public.interventions (id) on delete cascade,
  provider_id      uuid not null references public.providers (id) on delete cascade,
  business_id      uuid not null references public.businesses (id) on delete cascade,
  consented_by     uuid not null references public.profiles (id),
  consented_at     timestamptz not null default now(),
  status           text not null default 'active' check (status in ('active', 'ended'))
);
create table public.engagement_updates (
  id             uuid primary key default gen_random_uuid(),
  engagement_id  uuid not null references public.solution_engagements (id) on delete cascade,
  note           text not null check (char_length(note) between 2 and 1000),
  created_by     uuid not null default auth.uid() references public.profiles (id),
  created_at     timestamptz not null default now()
);
create trigger engagements_audit after insert or update on public.solution_engagements for each row execute function private.audit_row();

-- ─── RPCs ─────────────────────────────────────────────────────────────────────
create function public.register_provider(p_name text, p_kind text, p_contact text, p_description text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  pid uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  insert into public.providers (name, kind, contact, description) values (trim(p_name), p_kind, trim(p_contact), p_description) returning id into pid;
  insert into public.provider_members (provider_id, user_id) values (pid, auth.uid());
  return pid;
end $$;

create function public.review_provider(p_provider_id uuid, p_status text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_platform_admin() then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
  update public.providers set status = p_status where id = p_provider_id and p_status in ('approved', 'suspended');
  -- Suspending a provider takes its solutions off the marketplace.
  if p_status = 'suspended' then
    update public.solutions set status = 'deprecated' where provider_id = p_provider_id and status = 'active';
  end if;
end $$;

create function public.submit_solution(
  p_provider_id uuid, p_key text, p_name text, p_summary text, p_target_metric text, p_target_dimension text,
  p_window_days int, p_playbook jsonb, p_delivery text, p_pricing_model text, p_price_minor bigint, p_currency text,
  p_commercial_terms text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  sid uuid;
begin
  if not private.is_provider_member(p_provider_id)
     or not exists (select 1 from public.providers where id = p_provider_id and status = 'approved') then
    raise exception 'Only approved providers can submit solutions' using errcode = '42501';
  end if;
  insert into public.solutions (key, name, summary, target_dimension, target_metric, default_window_days, status, provider_id,
                                delivery, pricing_model, price_minor, currency, commercial_terms)
  values (p_key, p_name, p_summary, p_target_dimension, p_target_metric, p_window_days, 'submitted', p_provider_id,
          p_delivery, p_pricing_model, p_price_minor, upper(p_currency), p_commercial_terms)
  returning id into sid;
  insert into public.solution_versions (solution_id, version, playbook) values (sid, 1, coalesce(p_playbook, '[]'));
  return sid;
end $$;

create function public.review_solution(p_solution_id uuid, p_decision text, p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_platform_admin() then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
  if p_decision not in ('active', 'rejected') then
    raise exception 'Decision must be active or rejected' using errcode = '22023';
  end if;
  update public.solutions set status = p_decision::public.solution_status, review_note = p_note, reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_solution_id and status = 'submitted';
end $$;

-- Starting a provider-led solution is an explicit consent to share plan progress and results
-- (not the books) with that provider.
create function public.start_provider_solution(p_business_id uuid, p_solution_version_id uuid, p_consent boolean) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  s public.solutions;
  iid uuid;
begin
  if not private.has_role(p_business_id, array['owner', 'staff']::public.business_role[]) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select s2.* into s from public.solutions s2 join public.solution_versions v on v.solution_id = s2.id where v.id = p_solution_version_id;
  if s.provider_id is not null and s.delivery = 'provider_led' and not coalesce(p_consent, false) then
    raise exception 'Working with a provider needs your consent' using errcode = 'P0001';
  end if;
  iid := public.start_intervention(p_business_id, s.name, s.target_metric, s.default_window_days, null, p_solution_version_id);
  if s.provider_id is not null and s.delivery = 'provider_led' then
    insert into public.solution_engagements (intervention_id, provider_id, business_id, consented_by)
    values (iid, s.provider_id, p_business_id, auth.uid());
    perform private.emit_event(p_business_id, 'provider.engaged', 'provider', s.provider_id, jsonb_build_object('solution', s.name));
  end if;
  return iid;
end $$;

create function public.post_engagement_update(p_engagement_id uuid, p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  e public.solution_engagements;
begin
  select * into e from public.solution_engagements where id = p_engagement_id;
  if not found or e.status <> 'active' or not (private.is_provider_member(e.provider_id) or private.can_write(e.business_id)) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  insert into public.engagement_updates (engagement_id, note) values (e.id, p_note);
  perform private.emit_event(e.business_id, 'provider.update', 'provider', e.provider_id, jsonb_build_object('note', left(p_note, 120)));
end $$;

-- Provider view of their engagements: plan status and result only.
create function public.provider_engagements(p_provider_id uuid) returns table (
  engagement_id uuid, business_name text, solution text, plan_status text, started_at timestamptz, due_at timestamptz,
  result_improved boolean, result_status text, updates jsonb
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_provider_member(p_provider_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return query
  select e.id, b.name, i.title, i.status::text, i.started_at, i.due_at, o.improved, o.status::text,
    coalesce((select jsonb_agg(jsonb_build_object('note', u.note, 'at', u.created_at) order by u.created_at) from public.engagement_updates u where u.engagement_id = e.id), '[]')
  from public.solution_engagements e
  join public.interventions i on i.id = e.intervention_id
  join public.businesses b on b.id = e.business_id
  left join public.outcomes o on o.intervention_id = i.id
  where e.provider_id = p_provider_id order by i.started_at desc;
end $$;

revoke execute on function public.register_provider(text, text, text, text), public.review_provider(uuid, text),
  public.submit_solution(uuid, text, text, text, text, text, int, jsonb, text, text, bigint, text, text),
  public.review_solution(uuid, text, text), public.start_provider_solution(uuid, uuid, boolean),
  public.post_engagement_update(uuid, text), public.provider_engagements(uuid) from public, anon;
grant execute on function public.register_provider(text, text, text, text), public.review_provider(uuid, text),
  public.submit_solution(uuid, text, text, text, text, text, int, jsonb, text, text, bigint, text, text),
  public.review_solution(uuid, text, text), public.start_provider_solution(uuid, uuid, boolean),
  public.post_engagement_update(uuid, text), public.provider_engagements(uuid) to authenticated;

-- ─── RLS ──────────────────────────────────────────────────────────────────────
alter table public.providers enable row level security;
alter table public.provider_members enable row level security;
alter table public.solution_engagements enable row level security;
alter table public.engagement_updates enable row level security;

create policy "providers: approved public, own, admins" on public.providers for select to authenticated
  using (status = 'approved' or private.is_provider_member(id) or private.is_platform_admin());
create policy "provider members: own" on public.provider_members for select to authenticated using (user_id = (select auth.uid()));
create policy "engagements: business or provider" on public.solution_engagements for select to authenticated
  using (private.can_read(business_id) or private.is_provider_member(provider_id));
create policy "engagement updates: business or provider" on public.engagement_updates for select to authenticated
  using (exists (select 1 from public.solution_engagements e where e.id = engagement_id
                 and (private.can_read(e.business_id) or private.is_provider_member(e.provider_id))));
-- Providers see their own submissions (any status).
create policy "solutions: provider's own" on public.solutions for select to authenticated using (provider_id is not null and private.is_provider_member(provider_id));
create policy "versions: provider's own" on public.solution_versions for select to authenticated
  using (exists (select 1 from public.solutions s where s.id = solution_id and s.provider_id is not null and private.is_provider_member(s.provider_id)));
revoke insert, update, delete on public.providers, public.provider_members, public.solution_engagements, public.engagement_updates from authenticated;
