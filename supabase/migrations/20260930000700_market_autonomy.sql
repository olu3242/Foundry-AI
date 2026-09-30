-- Batch 9: AI authority (autonomy levels + action inbox), Growth agent, Market.

-- ─── Autonomy ─────────────────────────────────────────────────────────────────
-- Levels (plain language in lib/autonomy): 0 off · 1 suggest · 2 draft for approval ·
-- 3 act on routine cases, ask on unusual · 4 act and tell you · 5 act within limits, weekly report.
create table public.autonomy_policies (
  business_id  uuid not null references public.businesses (id) on delete cascade,
  action_type  text not null check (action_type in ('capture.record', 'growth.recommend', 'customer.reminder', 'stock.alert', 'market.match')),
  level        smallint not null check (level between 0 and 5),
  updated_by   uuid default auth.uid() references public.profiles (id),
  updated_at   timestamptz not null default now(),
  primary key (business_id, action_type)
);

create type public.action_status as enum ('proposed', 'approved', 'rejected', 'executed', 'failed', 'expired');

create table public.agent_actions (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses (id) on delete cascade,
  agent_run_id    uuid references public.agent_runs (id) on delete set null,
  action_type     text not null,
  autonomy_level  smallint not null check (autonomy_level between 0 and 5),
  title           text not null check (char_length(title) <= 160),
  body            text check (char_length(body) <= 2000),
  payload         jsonb not null default '{}',
  source          text,
  dedupe_key      text,
  status          public.action_status not null default 'proposed',
  decided_by      uuid references public.profiles (id),
  decided_at      timestamptz,
  executed_at     timestamptz,
  result          jsonb,
  expires_at      timestamptz,
  created_at      timestamptz not null default now()
);
create index agent_actions_inbox_idx on public.agent_actions (business_id, created_at desc) where status = 'proposed';
create unique index agent_actions_dedupe_idx on public.agent_actions (business_id, action_type, dedupe_key)
  where dedupe_key is not null and status = 'proposed';

create function public.decide_action(p_action_id uuid, p_decision text, p_result jsonb default null) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  a public.agent_actions;
begin
  if p_decision not in ('approved', 'rejected', 'executed') then
    raise exception 'Unknown decision' using errcode = '22023';
  end if;
  update public.agent_actions
  set status = p_decision::public.action_status, decided_by = auth.uid(), decided_at = now(),
      executed_at = case when p_decision = 'executed' then now() end, result = p_result
  where id = p_action_id and status in ('proposed', 'approved') and private.can_write(business_id)
  returning * into a;
  if not found then
    raise exception 'Action not found or already handled' using errcode = 'P0002';
  end if;
  perform private.emit_event(a.business_id, 'action.' || p_decision, 'agent_action', a.id,
    jsonb_build_object('action_type', a.action_type, 'title', a.title));
end $$;
revoke execute on function public.decide_action(uuid, text, jsonb) from public, anon;
grant execute on function public.decide_action(uuid, text, jsonb) to authenticated;

-- ─── Market ───────────────────────────────────────────────────────────────────
create table public.opportunities (
  id                     uuid primary key default gen_random_uuid(),
  title                  text not null check (char_length(title) between 4 and 140),
  description            text not null check (char_length(description) <= 3000),
  category               text not null check (category in ('supply_contract', 'buyer_request', 'financing', 'training', 'grant', 'other')),
  sectors                text[] not null default '{}',
  countries              text[] not null default '{}',
  min_months_records     smallint not null default 0 check (min_months_records between 0 and 36),
  min_proof_level        public.provenance not null default 'self_reported',
  budget_min_minor       bigint check (budget_min_minor >= 0),
  budget_max_minor       bigint check (budget_max_minor >= 0),
  currency               text check (currency ~ '^[A-Z]{3}$'),
  deadline               date,
  contact                text check (char_length(contact) <= 200),
  posted_by_business_id  uuid references public.businesses (id) on delete cascade,
  created_by             uuid references public.profiles (id) default auth.uid(),
  is_sample              boolean not null default false,
  status                 text not null default 'open' check (status in ('open', 'closed')),
  created_at             timestamptz not null default now()
);
create index opportunities_open_idx on public.opportunities (created_at desc) where status = 'open';

create table public.opportunity_matches (
  opportunity_id  uuid not null references public.opportunities (id) on delete cascade,
  business_id     uuid not null references public.businesses (id) on delete cascade,
  score           smallint not null check (score between 0 and 100),
  eligible        boolean not null,
  reasons         jsonb not null default '[]',
  gaps            jsonb not null default '[]',
  status          text not null default 'suggested' check (status in ('suggested', 'interested', 'dismissed')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  primary key (opportunity_id, business_id)
);
create index opportunity_matches_business_idx on public.opportunity_matches (business_id, score desc);
create trigger opportunity_matches_touch before update on public.opportunity_matches
  for each row execute function private.touch_updated_at();

create function private.match_events() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'interested' and old.status <> 'interested' then
    perform private.emit_event(new.business_id, 'market.interested', 'opportunity', new.opportunity_id,
      jsonb_build_object('title', (select title from public.opportunities where id = new.opportunity_id)));
  end if;
  return new;
end $$;
create trigger opportunity_matches_events after update on public.opportunity_matches
  for each row execute function private.match_events();

-- New opportunities get matched promptly.
create function private.on_opportunity_created() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.enqueue_job('market.match', null, jsonb_build_object('opportunity_id', new.id), 'match:' || new.id);
  return new;
end $$;
create trigger opportunities_match after insert on public.opportunities
  for each row execute function private.on_opportunity_created();

-- ─── RLS ──────────────────────────────────────────────────────────────────────
alter table public.autonomy_policies enable row level security;
alter table public.agent_actions enable row level security;
alter table public.opportunities enable row level security;
alter table public.opportunity_matches enable row level security;

create policy "autonomy: read" on public.autonomy_policies for select to authenticated using (private.can_read(business_id));
create policy "autonomy: owners set" on public.autonomy_policies for insert to authenticated
  with check (private.has_role(business_id, array['owner']::public.business_role[]));
create policy "autonomy: owners change" on public.autonomy_policies for update to authenticated
  using (private.has_role(business_id, array['owner']::public.business_role[]))
  with check (private.has_role(business_id, array['owner']::public.business_role[]));

create policy "actions: read" on public.agent_actions for select to authenticated using (private.can_read(business_id));
create policy "actions: decide" on public.agent_actions for update to authenticated
  using (private.can_write(business_id)) with check (private.can_write(business_id));

create policy "opportunities: open to all members" on public.opportunities for select to authenticated
  using (status = 'open' or created_by = (select auth.uid()));
create policy "opportunities: owners post" on public.opportunities for insert to authenticated
  with check (created_by = (select auth.uid()) and is_sample = false
              and (posted_by_business_id is null or private.has_role(posted_by_business_id, array['owner']::public.business_role[])));
create policy "opportunities: posters close" on public.opportunities for update to authenticated
  using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()));

create policy "matches: business reads" on public.opportunity_matches for select to authenticated
  using (private.can_read(business_id));
create policy "matches: posters see interest" on public.opportunity_matches for select to authenticated
  using (status = 'interested' and exists (
    select 1 from public.opportunities o where o.id = opportunity_id and o.created_by = (select auth.uid())));
create policy "matches: business responds" on public.opportunity_matches for update to authenticated
  using (private.can_write(business_id)) with check (private.can_write(business_id));

revoke insert, delete on public.agent_actions, public.opportunity_matches from authenticated;
revoke delete on public.opportunities, public.autonomy_policies from authenticated;
revoke update on public.opportunity_matches from authenticated;
grant update (status) on public.opportunity_matches to authenticated;
revoke update on public.agent_actions from authenticated;
grant update (status, decided_by, decided_at, executed_at, result) on public.agent_actions to authenticated;
