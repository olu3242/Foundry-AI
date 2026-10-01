begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000a011', 'owner@sol.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000b011', 'admin@sol.test', 'authenticated', 'authenticated');
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-00000000b011');
create function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
select v.id as vid from public.solution_versions v join public.solutions s on s.id = v.solution_id where s.key = 'grow_sales_push' \gset

set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000a011');
select public.create_business('Sol Shop') as bid \gset
select ok((select count(*) from public.solutions) >= 6, 'starter catalogue is visible');
select public.start_intervention(:'bid', 'Push best seller', 'sales_30', 14, null, :'vid') as i1 \gset
select public.start_intervention(:'bid', 'Push again', 'sales_30', 14, null, :'vid') as i2 \gset
select public.start_intervention(:'bid', 'Push thrice', 'sales_30', 14, null, :'vid') as i3 \gset
select public.complete_intervention(:'i1');
select public.complete_intervention(:'i2');
select public.abandon_intervention(:'i3', 'no_time');
reset role; set local role service_role;
insert into public.outcomes (intervention_id, business_id, metric, baseline_value, observed_value, delta, improved, window_start, window_end, status)
values (:'i1', :'bid', 'sales_30', 100, 150, 50, true, now(), now(), 'verified'),
       (:'i2', :'bid', 'sales_30', 100, 90, -10, false, now(), now(), 'observed');

set local role authenticated;
select results_eq(
  format($$ select activated, completed, abandoned, improved, verified from public.solution_effectiveness() where version_id = %L $$, :'vid'),
  $$ values (3, 2, 1, 1, 1) $$, 'funnel: activated → completed → improved → verified');
select is((select failure_reasons from public.solution_effectiveness() where version_id = :'vid'), '{"no_time": 1, "not_improved": 1}'::jsonb, 'failure reasons are counted');
select is((select sample_ok from public.solution_effectiveness() where version_id = :'vid'), false, 'small samples are flagged');
select is((select completion_rate from public.solution_effectiveness() where version_id = :'vid'), 0.667, 'completion rate');

select throws_ok(format($$ select public.deprecate_solution_version(%L, 'x') $$, :'vid'), '42501', null, 'only platform admins deprecate');
select pg_temp.login('00000000-0000-0000-0000-00000000b011');
select public.deprecate_solution_version(:'vid', 'Replaced by v2');
select pg_temp.login('00000000-0000-0000-0000-00000000a011');
select throws_ok(format($$ select public.start_intervention(%L, 'Old version', 'sales_30', 14, null, %L) $$, :'bid', :'vid'), 'P0001', null, 'deprecated versions cannot start new plans');
select is((select version_status from public.solution_effectiveness() where version_id = :'vid'), 'deprecated', 'history stays measurable after deprecation');

select * from finish();
rollback;
