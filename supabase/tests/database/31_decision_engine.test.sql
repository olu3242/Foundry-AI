begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000a033', 'owner@b33.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000d033', 'other@b33.test', 'authenticated', 'authenticated');
create function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
select v.id as push_v from public.solution_versions v join public.solutions s on s.id = v.solution_id where s.key = 'grow_sales_push' and v.status = 'active' order by v.version desc limit 1 \gset

set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000a033');
select public.create_business('Decide Shop') as bid \gset
reset role;
insert into public.pulse_snapshots (business_id, computed_on, dimension, state, why) values (:'bid', current_date, 'sales_momentum', 'at_risk', 'Sales fell 30%');
set local role authenticated;

select pg_temp.login('00000000-0000-0000-0000-00000000d033');
select throws_ok(format($$ select public.create_decision(%L, 'sales_momentum') $$, :'bid'), '42501', null, 'only the business can create its decisions');
select pg_temp.login('00000000-0000-0000-0000-00000000a033');
select public.create_decision(:'bid', 'sales_momentum') as d1 \gset
select is((select signal ->> 'state' from public.decisions where id = :'d1'), 'at_risk', 'SIGNAL recorded');
select ok((select options @> '[{"key":"grow_sales_push"}]' and options @> '[{"key":"do_nothing"}]' from public.decisions where id = :'d1'), 'OPTIONS include a plan and doing nothing');
select ok((select (options -> 0 -> 'expected_value' ? 'p_improve') and (options -> 0 -> 'risk' ? 'policy') from public.decisions where id = :'d1'), 'each option has EXPECTED VALUE and RISK');
select ok((select evidence ? 'memory' and authority ->> 'rule' = 'Foundry recommends; a person decides' from public.decisions where id = :'d1'), 'EVIDENCE and AUTHORITY recorded');
select is((select recommended from public.decisions where id = :'d1'), 'grow_sales_push', 'at risk → the evidence-backed plan is recommended');

select public.start_intervention(:'bid', 'Push', 'sales_30', 7, null, :'push_v') as iid \gset
select is((select status || ':' || decided_by || ':' || chosen from public.decisions where id = :'d1'), 'accepted:human:grow_sales_push', 'a person accepting is the DECISION');
select public.complete_intervention(:'iid');
reset role;
insert into public.outcomes (intervention_id, business_id, metric, baseline_value, observed_value, delta, improved, window_start, window_end)
values (:'iid', :'bid', 'sales_30', 100, 90, -10, false, now() - interval '7 days', now());
set local role authenticated;
select is((select result ->> 'improved' from public.decisions where id = :'d1'), 'false', 'RESULT flows back from the outcome');

-- Memory changes the next decision: the plan that did not help is marked and down-weighted.
select public.refresh_business_memory(:'bid');
select public.create_decision(:'bid', 'sales_momentum') as d2 \gset
select is((select (o -> 'risk' ->> 'tried_before_without_improvement')::boolean from public.decisions, jsonb_array_elements(options) o
           where id = :'d2' and o ->> 'key' = 'grow_sales_push'), true, 'history informs risk');
select public.start_intervention(:'bid', 'My own idea', 'sales_30', 7) ;
select is((select status || ':' || chosen from public.decisions where id = :'d2'), 'overridden:custom', 'a person can override with their own plan');

-- Reproducible.
select is((public.explain_decision(:'d1') -> 'replay' ->> 'matches')::boolean, true, 'decisions replay from stored options');
reset role;
update public.decisions set options = jsonb_set(options, '{0,score}', '9') where id = :'d1';
set local role authenticated;
select is((public.explain_decision(:'d1') -> 'replay' ->> 'matches')::boolean, false, 'tampered inputs are detected');
select is((select count(*)::int from public.audit_log where table_name = 'decisions' and business_id = :'bid') >= 4, true, 'decisions are audited');

select * from finish();
rollback;
