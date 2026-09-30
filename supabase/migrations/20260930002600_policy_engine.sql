-- B28 Risk + policy engine: versioned, configurable policies at global / market / program /
-- provider / solution scope, evaluated at existing decision points (no application forks).
-- Every evaluation records policy, version, input, result, reason and time.
-- Reuses B2 tenancy, B9/B23 autonomy, B16 evidence packages, B11 outcomes, B17 solutions, B19 markets.
--
-- Rule format: { "rules": [ { "if": {"field": "...", "op": ">", "value": 500}, "then": "deny", "reason": "..." } ],
--                "default": "allow", "params": { ... } }
-- Results: allow | deny | cap:N (AI autonomy ceiling). Layers combine: deny wins, caps take the minimum.

create table public.policies (
  id              uuid primary key default gen_random_uuid(),
  key             text not null check (key in ('finance.evidence_share', 'solution.start', 'ai.autonomy', 'escalation.record_requests', 'partner.verify_outcome')),
  scope_type      text not null check (scope_type in ('global', 'market', 'program', 'provider', 'solution')),
  scope_id        text not null default '*',
  version         int not null,
  definition      jsonb not null,
  status          text not null default 'draft' check (status in ('draft', 'active', 'retired')),
  note            text,
  created_by      uuid default auth.uid() references public.profiles (id),
  created_at      timestamptz not null default now(),
  activated_at    timestamptz,
  unique (key, scope_type, scope_id, version)
);
create unique index policies_one_active on public.policies (key, scope_type, scope_id) where status = 'active';
create trigger policies_audit after insert or update on public.policies for each row execute function private.audit_row();

create table public.policy_decisions (
  id           bigint generated always as identity primary key,
  policy_id    uuid not null references public.policies (id),
  policy_key   text not null,
  version      int not null,
  scope        text not null,
  business_id  uuid references public.businesses (id) on delete cascade,
  input        jsonb not null,
  result       text not null,
  reason       text,
  decided_at   timestamptz not null default now()
);
create index policy_decisions_policy_idx on public.policy_decisions (policy_id, decided_at desc);
create index policy_decisions_business_idx on public.policy_decisions (business_id, decided_at desc);

-- One condition against the context.
create function private.policy_match(cond jsonb, ctx jsonb) returns boolean
language plpgsql immutable set search_path = '' as $$
declare
  v jsonb := ctx -> (cond ->> 'field');
  op text := cond ->> 'op';
  target jsonb := cond -> 'value';
begin
  if cond is null then
    return true;
  end if;
  if cond ? 'all' then
    return not exists (select 1 from jsonb_array_elements(cond -> 'all') c where not private.policy_match(c, ctx));
  end if;
  if op = 'exists' then
    return v is not null and v <> 'null'::jsonb;
  end if;
  if v is null or v = 'null'::jsonb then
    return op = '!=';
  end if;
  return case op
    when '=' then v = target
    when '!=' then v <> target
    when 'in' then target @> jsonb_build_array(v)
    when 'not_in' then not (target @> jsonb_build_array(v))
    when '>' then (v #>> '{}')::numeric > (target #>> '{}')::numeric
    when '>=' then (v #>> '{}')::numeric >= (target #>> '{}')::numeric
    when '<' then (v #>> '{}')::numeric < (target #>> '{}')::numeric
    when '<=' then (v #>> '{}')::numeric <= (target #>> '{}')::numeric
    else false end;
end $$;

-- First matching rule wins within one policy.
create function private.policy_apply(def jsonb, ctx jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select coalesce(
    (select jsonb_build_object('result', r ->> 'then', 'reason', r ->> 'reason') from jsonb_array_elements(coalesce(def -> 'rules', '[]')) with ordinality t(r, i)
     where private.policy_match(r -> 'if', ctx) order by i limit 1),
    jsonb_build_object('result', coalesce(def ->> 'default', 'allow'), 'reason', null));
$$;

-- Evaluates every active layer that applies to the context; records each decision unless dry-run.
create function private.evaluate_policy(p_key text, ctx jsonb, p_business_id uuid default null, p_record boolean default true) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  p public.policies;
  out jsonb;
  final text := 'allow';
  cap int;
  reasons jsonb := '[]';
  params jsonb := '{}';
  applied jsonb := '[]';
begin
  for p in
    select * from public.policies where key = p_key and status = 'active' and (
      scope_type = 'global'
      or (scope_type = 'market' and scope_id = ctx ->> 'market')
      or (scope_type = 'program' and ctx -> 'programs' @> jsonb_build_array(scope_id))
      or (scope_type = 'provider' and scope_id = ctx ->> 'provider_id')
      or (scope_type = 'solution' and scope_id = ctx ->> 'solution_id'))
    order by array_position(array['global', 'market', 'program', 'provider', 'solution'], scope_type)
  loop
    out := private.policy_apply(p.definition, ctx);
    params := params || coalesce(p.definition -> 'params', '{}');   -- more specific scopes override
    applied := applied || jsonb_build_object('policy_id', p.id, 'scope', p.scope_type || ':' || p.scope_id, 'version', p.version, 'result', out ->> 'result');
    if out ->> 'result' = 'deny' then
      final := 'deny';
    elsif out ->> 'result' like 'cap:%' and final <> 'deny' then
      cap := least(coalesce(cap, 5), split_part(out ->> 'result', ':', 2)::int);
      final := 'cap:' || cap;
    end if;
    if out ->> 'reason' is not null then
      reasons := reasons || to_jsonb(out ->> 'reason');
    end if;
    if p_record then
      insert into public.policy_decisions (policy_id, policy_key, version, scope, business_id, input, result, reason)
      values (p.id, p.key, p.version, p.scope_type || ':' || p.scope_id, p_business_id, ctx, out ->> 'result', out ->> 'reason');
    end if;
  end loop;
  return jsonb_build_object('result', final, 'reasons', reasons, 'params', params, 'applied', applied);
end $$;

-- Business context shared by decision points.
create function private.policy_context(bid uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('market', b.country_code, 'currency', b.currency,
    'programs', coalesce((select jsonb_agg(program_id::text) from public.program_enrollments where business_id = bid and status = 'active'), '[]'),
    'months_of_records', (select coalesce(extract(month from age(now(), min(occurred_at)))::int + 12 * extract(year from age(now(), min(occurred_at)))::int, 0)
                          from public.sales where business_id = bid and voided_at is null),
    'verified_identifier', exists (select 1 from public.business_identifiers where business_id = bid and verified))
  from public.businesses b where b.id = bid;
$$;

create function private.evidence_policy_ctx(bid uuid, product uuid, amount_minor bigint) returns jsonb
language sql stable security definer set search_path = '' as $$
  select private.policy_context(bid) || jsonb_build_object('requested_amount_usd',
    private.to_usd(coalesce(amount_minor, 0), (select currency from public.financial_products where id = product)));
$$;

create function private.solution_policy_ctx(bid uuid, svid uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select private.policy_context(bid) || jsonb_build_object('solution_id', s.id::text, 'provider_id', s.provider_id::text,
    'pricing_model', s.pricing_model, 'delivery', s.delivery, 'price_usd', private.to_usd(coalesce(s.price_minor, 0), coalesce(s.currency, 'USD')))
  from public.solution_versions v join public.solutions s on s.id = v.solution_id where v.id = svid;
$$;

-- ─── Decision points (triggers on existing workflows) ─────────────────────────
-- A denial raises and rolls back its own statement, so callers run check_policy() first: that
-- records the decision (allow or deny) in its own statement; the trigger remains the hard guard.
create function private.policy_gate_evidence() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  d jsonb;
begin
  d := private.evaluate_policy('finance.evidence_share', private.evidence_policy_ctx(new.business_id, new.product_id, new.requested_amount_minor), new.business_id);
  if d ->> 'result' = 'deny' then
    raise exception '%', coalesce(d -> 'reasons' ->> 0, 'Not allowed by policy') using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger evidence_packages_policy before insert on public.evidence_packages for each row execute function private.policy_gate_evidence();

create function private.policy_gate_solution() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  d jsonb;
begin
  if new.solution_version_id is null then
    return new;
  end if;
  d := private.evaluate_policy('solution.start', private.solution_policy_ctx(new.business_id, new.solution_version_id), new.business_id);
  if d ->> 'result' = 'deny' then
    raise exception '%', coalesce(d -> 'reasons' ->> 0, 'This plan isn''t available under your program''s rules') using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger interventions_policy before insert on public.interventions for each row execute function private.policy_gate_solution();

create function private.policy_gate_verification() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  d jsonb;
begin
  if new.status = 'verified' and old.status is distinct from 'verified' then
    d := private.evaluate_policy('partner.verify_outcome',
      private.policy_context(new.business_id) || jsonb_build_object('verifier_role', new.verifier_role, 'improved', new.improved), new.business_id);
    if d ->> 'result' = 'deny' then
      raise exception '%', coalesce(d -> 'reasons' ->> 0, 'Your program requires a different verifier') using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
create trigger outcomes_policy before update of status on public.outcomes for each row execute function private.policy_gate_verification();

-- AI autonomy ceiling (B23): level in force is also capped by policy.
create or replace function private.ops_level(bid uuid, action text, dflt int, cap int) returns int
language plpgsql security definer set search_path = '' as $$
declare
  lvl int := greatest(0, least(coalesce((select level from public.autonomy_policies where business_id = bid and action_type = action), dflt), cap));
  d jsonb;
begin
  d := private.evaluate_policy('ai.autonomy', private.policy_context(bid) || jsonb_build_object('action_type', action, 'level', lvl), bid);
  if d ->> 'result' like 'cap:%' then
    lvl := least(lvl, split_part(d ->> 'result', ':', 2)::int);
  end if;
  return lvl;
end $$;

-- Escalation threshold (B23): programs can tune how many ignored requests escalate.
create function private.escalation_threshold(bid uuid) returns int
language sql security definer set search_path = '' as $$
  select coalesce((private.evaluate_policy('escalation.record_requests', private.policy_context(bid), bid, false) -> 'params' ->> 'threshold')::int, 3);
$$;

-- B23 routine ops with the policy-driven escalation threshold (only change: the threshold).
create or replace function public.run_routine_ops(p_business_id uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  b record;
  r record;
  run uuid;
  lvl int;
  last_rec timestamptz;
  acted int := 0;
  escalated int := 0;
  routed int := 0;
  aid uuid;
  partner uuid;
  wk text := to_char(now(), 'IYYY-IW');
begin
  if coalesce(auth.role(), '') <> 'service_role' and not private.is_platform_admin() then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
  for b in select id from public.businesses where p_business_id is null or id = p_business_id loop
    run := null;
    select max(occurred_at) into last_rec from public.events
    where business_id = b.id and type in ('sale.recorded', 'expense.recorded', 'stock.moved', 'capture.received');

    -- 1. Record request: active in the last 30 days but nothing for 3+ days (dormancy is B22's job).
    if last_rec between now() - interval '30 days' and now() - interval '3 days' then
      lvl := private.ops_level(b.id, 'ops.record_request', 4, 4);
      insert into public.agent_runs (business_id, agent, trigger, model, status, output) values (b.id, 'ops-automation', 'schedule', 'rules:ops-v1', 'succeeded', '{}') returning id into run;
      aid := private.ops_act(b.id, run, 'ops.record_request', lvl, 4, 'Catch up on the last few days',
        'Nothing has been recorded since ' || to_char(last_rec, 'DD Mon') || '. Say or type what you sold and spent — it takes a minute.',
        'rr:' || wk, jsonb_build_object('last_record_at', last_rec, 'days_without_records', extract(day from now() - last_rec)::int));
      if aid is not null then acted := acted + 1; end if;
      -- Unusual: N (policy, default 3) requests in three weeks without a record → a person follows up.
      if (select count(*) from public.agent_actions where business_id = b.id and action_type = 'ops.record_request' and created_at > now() - interval '21 days' and created_at > last_rec) >= private.escalation_threshold(b.id) then
        for r in select e.program_id from public.program_enrollments e where e.business_id = b.id and e.status = 'active' loop
          if private.ops_escalate(b.id, r.program_id, 'ignored_requests', 'Three record requests went unanswered',
               jsonb_build_object('last_record_at', last_rec), aid, 'ignored:' || b.id || ':' || wk) is not null then escalated := escalated + 1; end if;
        end loop;
      end if;
    end if;

    -- 2. Plan reminder: an active plan ends within two days.
    for r in select id, title, due_at from public.interventions where business_id = b.id and status = 'active' and due_at between now() and now() + interval '2 days' loop
      lvl := private.ops_level(b.id, 'ops.plan_reminder', 4, 4);
      if run is null then
        insert into public.agent_runs (business_id, agent, trigger, model, status, output) values (b.id, 'ops-automation', 'schedule', 'rules:ops-v1', 'succeeded', '{}') returning id into run;
      end if;
      aid := private.ops_act(b.id, run, 'ops.plan_reminder', lvl, 4, 'Your plan "' || left(r.title, 80) || '" ends ' || to_char(r.due_at, 'DD Mon'),
        'Mark it done when you have finished so Foundry can measure the result.', 'pr:' || r.id,
        jsonb_build_object('intervention_id', r.id, 'due_at', r.due_at));
      if aid is not null then acted := acted + 1; end if;
    end loop;

    -- 3. Verification routing: a measured result waits 3+ days for a partner's check.
    for r in select o.id outcome_id, e.program_id, p.auto_route from public.outcomes o
             join public.program_enrollments e on e.business_id = o.business_id and e.status = 'active'
             join public.programs p on p.id = e.program_id
             where o.business_id = b.id and o.status = 'observed' and o.measured_at < now() - interval '3 days'
               and not exists (select 1 from public.partner_assignments a where a.program_id = e.program_id and a.business_id = o.business_id) loop
      partner := null;
      if r.auto_route then
        select m.user_id into partner from public.program_members m
        where m.program_id = r.program_id and m.role = 'partner'
        order by (select count(*) from public.partner_assignments a where a.partner_user_id = m.user_id), m.user_id limit 1;
      end if;
      if partner is not null then
        insert into public.partner_assignments (program_id, partner_user_id, business_id) values (r.program_id, partner, b.id) on conflict do nothing;
        if run is null then
          insert into public.agent_runs (business_id, agent, trigger, model, status, output) values (b.id, 'ops-automation', 'schedule', 'rules:ops-v1', 'succeeded', '{}') returning id into run;
        end if;
        insert into public.agent_actions (business_id, agent_run_id, action_type, autonomy_level, title, body, payload, source, dedupe_key, status, executed_at, generator)
        values (b.id, run, 'ops.route_verifier', 4, 'A partner was assigned to check your result', 'They can now verify it.',
          jsonb_build_object('authority', jsonb_build_object('level', 4, 'mode', 'auto_notify', 'policy', 'program.auto_route', 'program_id', r.program_id),
            'evidence', jsonb_build_object('outcome_id', r.outcome_id), 'effect', jsonb_build_object('program_id', r.program_id, 'partner_user_id', partner, 'business_id', b.id), 'reversible', true),
          'ops-automation', 'route:' || r.outcome_id, 'executed', now(), 'ops-v1')
        on conflict do nothing;
        routed := routed + 1;
      elsif private.ops_escalate(b.id, r.program_id, 'assign_verifier', 'A measured result needs a partner to verify it',
              jsonb_build_object('outcome_id', r.outcome_id, 'auto_route', r.auto_route), null, 'verify:' || r.outcome_id || ':' || r.program_id) is not null then
        escalated := escalated + 1;
      end if;
    end loop;
  end loop;
  return jsonb_build_object('acted', acted, 'routed', routed, 'escalated', escalated);
end $$;

-- ─── Administration ───────────────────────────────────────────────────────────
create function public.save_policy(p_key text, p_scope_type text, p_scope_id text, p_definition jsonb, p_note text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v int;
  pid uuid;
begin
  if not private.is_platform_admin() then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
  if jsonb_typeof(coalesce(p_definition -> 'rules', '[]')) <> 'array'
     or exists (select 1 from jsonb_array_elements(coalesce(p_definition -> 'rules', '[]')) r
                where (r ->> 'then') !~ '^(allow|deny|cap:[0-5])$') then
    raise exception 'Rules need "then": allow, deny or cap:0–5' using errcode = '22023';
  end if;
  select coalesce(max(version), 0) + 1 into v from public.policies where key = p_key and scope_type = p_scope_type and scope_id = coalesce(p_scope_id, '*');
  insert into public.policies (key, scope_type, scope_id, version, definition, note)
  values (p_key, p_scope_type, coalesce(nullif(p_scope_id, ''), '*'), v, p_definition, p_note) returning id into pid;
  return pid;
end $$;

create function public.activate_policy(p_policy_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  p public.policies;
begin
  if not private.is_platform_admin() then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
  select * into p from public.policies where id = p_policy_id;
  update public.policies set status = 'retired' where key = p.key and scope_type = p.scope_type and scope_id = p.scope_id and status = 'active';
  update public.policies set status = 'active', activated_at = now() where id = p.id;
end $$;

create function public.retire_policy(p_policy_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_platform_admin() then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
  update public.policies set status = 'retired' where id = p_policy_id;
end $$;

-- Pre-check from the application: records the decision (including denials) and returns it.
create function public.check_policy(p_key text, p_business_id uuid, p_params jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not private.can_read(p_business_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return private.evaluate_policy(p_key, case p_key
      when 'solution.start' then private.solution_policy_ctx(p_business_id, (p_params ->> 'solution_version_id')::uuid)
      when 'finance.evidence_share' then private.evidence_policy_ctx(p_business_id, (p_params ->> 'product_id')::uuid, (p_params ->> 'amount_minor')::bigint)
      when 'partner.verify_outcome' then private.policy_context(p_business_id) || jsonb_build_object('verifier_role', public.my_business_role(p_business_id))
      else private.policy_context(p_business_id) || p_params end, p_business_id);
end $$;

-- Dry run: what would happen for a context, without recording.
create function public.simulate_policy(p_key text, p_context jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_platform_admin() then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
  return private.evaluate_policy(p_key, p_context, null, false);
end $$;

revoke execute on function public.save_policy(text, text, text, jsonb, text), public.activate_policy(uuid), public.retire_policy(uuid),
  public.simulate_policy(text, jsonb), public.check_policy(text, uuid, jsonb) from public, anon;
grant execute on function public.save_policy(text, text, text, jsonb, text), public.activate_policy(uuid), public.retire_policy(uuid),
  public.simulate_policy(text, jsonb), public.check_policy(text, uuid, jsonb) to authenticated;

alter table public.policies enable row level security;
alter table public.policy_decisions enable row level security;
create policy "policies: admins" on public.policies for select to authenticated using (private.is_platform_admin());
create policy "decisions: admins or business" on public.policy_decisions for select to authenticated
  using (private.is_platform_admin() or (business_id is not null and private.can_read(business_id)));
revoke insert, update, delete on public.policies, public.policy_decisions from authenticated;
