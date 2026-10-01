begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000a038', 'owner@b38.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000b038', 'admin@b38.test', 'authenticated', 'authenticated');
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-00000000b038');
create function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000a038');
select public.create_business('Quality Shop') as bid \gset
select public.create_business('Silent Shop') as quiet \gset
reset role;
-- Two outlooks made 35 days ago for 28 days: one business then recorded 40,000; the other recorded nothing.
insert into public.forecasts (business_id, kind, as_of, horizon_days, method, inputs, input_digest, assumptions, result, confidence, basis)
values (:'bid', 'sales_outlook', now() - interval '35 days', 28, 'test', '{}', 'x', '[]', '{"point":42000,"low":30000,"high":50000}', 'medium', 'test'),
       (:'quiet', 'sales_outlook', now() - interval '35 days', 28, 'test', '{}', 'x', '[]', '{"point":10000,"low":5000,"high":15000}', 'low', 'test');
insert into public.sales (business_id, total_minor, amount_paid_minor, currency, occurred_at)
values (:'bid', 40000, 40000, 'NGN', date_trunc('week', now() - interval '35 days') + interval '3 days');
-- Pulse precision: two at-risk signals, owner says one was right.
insert into public.pulse_snapshots (business_id, computed_on, dimension, state, why) values
  (:'bid', current_date - 1, 'cash_flow', 'at_risk', 'x'), (:'bid', current_date - 1, 'cost_control', 'at_risk', 'x');
insert into public.pulse_feedback (business_id, dimension, computed_on, verdict, user_id, user_role) values
  (:'bid', 'cash_flow', current_date - 1, 'accurate', '00000000-0000-0000-0000-00000000a038', 'owner'),
  (:'bid', 'cost_control', current_date - 1, 'inaccurate', '00000000-0000-0000-0000-00000000a038', 'owner');
-- Yesterday's forecast snapshot showed full coverage.
insert into public.eval_snapshots (taken_on, scope, subject, metrics) values (current_date - 1, 'forecasts', 'sales_outlook', '{"interval_coverage": 1.0, "mape": 0.01}');

set local role authenticated;
select throws_ok($$ select public.intelligence_quality() $$, '42501', null, 'the scorecard is platform-admin only');
select pg_temp.login('00000000-0000-0000-0000-00000000b038');
select is(public.evaluate_forecasts(), 2, 'past-horizon outlooks are backtested');
reset role;
select is((select in_interval from public.forecast_evaluations where business_id = :'bid'), true, 'actual inside the interval');
select is((select abs_pct_error from public.forecast_evaluations where business_id = :'bid'), 0.0500, 'error measured against what was recorded');
select is((select actual from public.forecast_evaluations where business_id = :'quiet'), null, 'no records → actual is unknown, not zero');
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000b038');
select is((public.intelligence_quality() -> 'forecasts' ->> 'interval_coverage')::numeric, 1.000, 'coverage uses only known actuals');
select is((public.intelligence_quality() -> 'pulse' ->> 'at_risk_precision')::numeric, 0.500, 'Pulse at-risk precision from owner feedback');
select is((public.intelligence_quality() -> 'pulse' ->> 'false_positive_rate')::numeric, 0.500, 'false positives counted');

-- Degradation is detected: today's coverage drops (simulated by a second evaluation outside the interval).
reset role;
insert into public.forecasts (id, business_id, kind, as_of, horizon_days, method, inputs, input_digest, assumptions, result, confidence, basis)
values (gen_random_uuid(), :'bid', 'sales_outlook', now() - interval '36 days', 28, 'test', '{}', 'y', '[]', '{"point":1000,"low":900,"high":1100}', 'low', 'test');
set local role authenticated;
select public.take_intelligence_snapshot();
reset role;
select is((select drift from public.eval_snapshots where scope = 'forecasts' and taken_on = current_date), true, 'a 15+ point coverage drop is flagged as drift');
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000b038');
select ok(jsonb_array_length(public.intelligence_quality() -> 'drift_alerts') >= 1, 'drift alerts surface on the scorecard');

select * from finish();
rollback;
