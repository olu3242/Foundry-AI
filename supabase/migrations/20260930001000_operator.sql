-- B12 Operator scale: prioritized exceptions across a portfolio, resolution tracking,
-- workload metrics and safe batch actions. Reuses B7 snapshots, B9 agent_actions, B10/B11 access.

-- Businesses the caller operates (partner or program access; never businesses they own).
create function private.my_portfolio() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select a.business_id from public.partner_assignments a
  join public.program_enrollments e on e.program_id = a.program_id and e.business_id = a.business_id
  where a.partner_user_id = (select auth.uid()) and e.status = 'active' and 'records' = any (e.consent_scope)
  union
  select e.business_id from public.program_enrollments e
  join public.program_members m on m.program_id = e.program_id and m.user_id = (select auth.uid()) and m.role = 'admin'
  where e.status = 'active' and 'records' = any (e.consent_scope)
  union
  select business_id from public.memberships where user_id = (select auth.uid()) and role = 'partner';
$$;
grant execute on function private.my_portfolio() to authenticated;

create table public.operator_snoozes (
  user_id   uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  item_key  text not null,
  until     timestamptz not null,
  primary key (user_id, item_key)
);

create table public.operator_item_log (
  user_id      uuid not null references public.profiles (id) on delete cascade,
  item_key     text not null,
  business_id  uuid not null references public.businesses (id) on delete cascade,
  kind         text not null,
  first_seen   timestamptz not null default now(),
  resolved_at  timestamptz,
  primary key (user_id, item_key, first_seen)
);
create index operator_item_log_open_idx on public.operator_item_log (user_id) where resolved_at is null;

-- Exceptions, highest severity first. item_key is stable per business+kind(+entity) so snoozes and
-- resolution tracking survive recomputation.
create function private.operator_items(p_user uuid) returns table (
  item_key text, business_id uuid, business_name text, kind text, severity int, title text, detail text, since timestamptz, link text
)
language sql stable security definer set search_path = '' as $$
  with p as (select private.my_portfolio() as bid),
  b as (select id, name from public.businesses where id in (select bid from p)),
  latest as (
    select distinct on (s.business_id) s.business_id, s.computed_on from public.pulse_snapshots s
    where s.business_id in (select id from b) order by s.business_id, s.computed_on desc
  ),
  risk as (
    select s.business_id, count(*) filter (where s.state = 'at_risk') n, min(s.computed_at) since
    from public.pulse_snapshots s join latest l on l.business_id = s.business_id and l.computed_on = s.computed_on
    group by s.business_id
  ),
  last_record as (
    select e.business_id, max(e.occurred_at) at from public.events e
    where e.business_id in (select id from b) and e.type in ('sale.recorded', 'expense.recorded', 'stock.moved', 'capture.received')
    group by e.business_id
  ),
  items as (
    select 'verify:' || o.id, o.business_id, 'outcome_to_verify', 70, 'Result waiting for your check',
           'A plan ended and its result was measured.', o.measured_at, '/progress'
    from public.outcomes o where o.business_id in (select id from b) and o.status = 'observed'
    union all
    select 'risk:' || r.business_id, r.business_id, 'pulse_at_risk', 60 + 5 * r.n::int, r.n || ' Pulse signal(s) need attention',
           'Latest Pulse has at-risk signals.', r.since, '/pulse'
    from risk r where r.n > 0
    union all
    select 'overdue:' || i.id, i.business_id, 'plan_overdue', 55, 'Plan past its end date', i.title, i.due_at, '/progress'
    from public.interventions i where i.business_id in (select id from b) and i.status = 'active' and i.due_at < now()
    union all
    select 'inactive:' || b.id, b.id, 'inactive', 50, 'No records for a week',
           coalesce('Last record ' || to_char(lr.at, 'DD Mon'), 'Nothing recorded yet'), coalesce(lr.at, now()), ''
    from b left join last_record lr on lr.business_id = b.id where lr.at is null or lr.at < now() - interval '7 days'
    union all
    select 'noplan:' || r.business_id, r.business_id, 'no_plan', 45, 'At risk with no plan running', 'Start a plan with the owner.', r.since, '/progress'
    from risk r where r.n > 0 and not exists (select 1 from public.interventions i where i.business_id = r.business_id and i.status = 'active')
    union all
    select 'captures:' || c.business_id, c.business_id, 'failed_captures', 40, count(*) || ' capture(s) could not be read',
           'Help the owner enter them by hand.', min(c.created_at), ''
    from public.captures c where c.business_id in (select id from b) and c.status = 'failed' and c.created_at > now() - interval '7 days'
    group by c.business_id
  )
  select i.item_key, i.business_id, b.name, i.kind, i.severity, i.title, i.detail, i.since, i.link
  from items i (item_key, business_id, kind, severity, title, detail, since, link)
  join b on b.id = i.business_id
  where not exists (select 1 from public.operator_snoozes z where z.user_id = p_user and z.item_key = i.item_key and z.until > now())
$$;

-- Returns the queue and records first-seen / resolved times for productivity metrics.
create function public.operator_queue() returns table (
  item_key text, business_id uuid, business_name text, kind text, severity int, title text, detail text, since timestamptz, link text
)
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  insert into public.operator_item_log (user_id, item_key, business_id, kind)
  select uid, q.item_key, q.business_id, q.kind from private.operator_items(uid) q
  where not exists (select 1 from public.operator_item_log l where l.user_id = uid and l.item_key = q.item_key and l.resolved_at is null);
  -- Items that disappeared (and aren't just snoozed) count as resolved.
  update public.operator_item_log l set resolved_at = now()
  where l.user_id = uid and l.resolved_at is null
    and not exists (select 1 from private.operator_items(uid) q where q.item_key = l.item_key)
    and not exists (select 1 from public.operator_snoozes z where z.user_id = uid and z.item_key = l.item_key and z.until > now());
  return query select q.* from private.operator_items(uid) q order by q.severity desc, q.since;
end $$;

create function public.operator_metrics() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'businesses', (select count(*) from private.my_portfolio()),
    'open_items', (select count(*) from public.operator_item_log where user_id = auth.uid() and resolved_at is null),
    'resolved_30d', (select count(*) from public.operator_item_log where user_id = auth.uid() and resolved_at > now() - interval '30 days'),
    'median_resolution_hours', (select round((percentile_cont(0.5) within group (order by extract(epoch from resolved_at - first_seen) / 3600))::numeric, 1)
                                from public.operator_item_log where user_id = auth.uid() and resolved_at > now() - interval '30 days'),
    'verified_outcomes_30d', (select count(*) from public.outcomes where verified_by = auth.uid() and verified_at > now() - interval '30 days'),
    'plans_started_30d', (select count(*) from public.interventions where created_by = auth.uid() and started_at > now() - interval '30 days')
  );
$$;

create function public.snooze_items(p_item_keys text[], p_days int) returns void
language sql security definer set search_path = '' as $$
  insert into public.operator_snoozes (user_id, item_key, until)
  select auth.uid(), k, now() + make_interval(days => least(greatest(p_days, 1), 30)) from unnest(p_item_keys) k
  on conflict (user_id, item_key) do update set until = excluded.until;
$$;

-- Safe batch action: an L1 suggestion in each owner's inbox. Never writes books, never messages customers.
create function public.batch_nudge(p_business_ids uuid[], p_message text) returns int
language plpgsql security definer set search_path = '' as $$
declare
  n int;
begin
  if cardinality(p_business_ids) > 100 then
    raise exception 'At most 100 businesses at a time' using errcode = 'P0001';
  end if;
  if char_length(trim(p_message)) not between 5 and 500 then
    raise exception 'Write a short note (5–500 characters)' using errcode = 'P0001';
  end if;
  insert into public.agent_actions (business_id, action_type, autonomy_level, title, body, source, dedupe_key)
  select bid, 'growth.recommend', 1, 'A note from your business partner', trim(p_message), 'operator', 'nudge:' || auth.uid() || ':' || current_date
  from unnest(p_business_ids) bid
  where bid in (select private.my_portfolio())
  on conflict do nothing;
  get diagnostics n = row_count;
  perform private.emit_event(bid, 'operator.nudged', 'business', bid, jsonb_build_object('by', auth.uid()))
  from unnest(p_business_ids) bid where bid in (select private.my_portfolio());
  return n;
end $$;

revoke execute on function public.operator_queue(), public.operator_metrics(), public.snooze_items(text[], int),
  public.batch_nudge(uuid[], text) from public, anon;
grant execute on function public.operator_queue(), public.operator_metrics(), public.snooze_items(text[], int),
  public.batch_nudge(uuid[], text) to authenticated;

alter table public.operator_snoozes enable row level security;
alter table public.operator_item_log enable row level security;
create policy "snoozes: own" on public.operator_snoozes for select to authenticated using (user_id = (select auth.uid()));
create policy "item log: own" on public.operator_item_log for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete on public.operator_snoozes, public.operator_item_log from authenticated;
