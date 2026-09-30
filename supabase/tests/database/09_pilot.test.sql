begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000a9', 'owner@pilot.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b9', 'op@pilot.test', 'authenticated', 'authenticated');
create function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-0000000000b9');
select public.create_program('Pilot One') as pid \gset
select join_code as code from public.programs where id = :'pid' \gset

select pg_temp.login('00000000-0000-0000-0000-0000000000a9');
select public.create_business('Pilot Shop', null, 'NG', 'NGN') as bid \gset
select public.join_program(:'bid', :'code', true);
select is((select count(*)::int from public.jobs where dedupe_key = 'baseline:' || :'bid' || ':' || :'pid'), 1, 'joining a program schedules a baseline');

select public.record_entry(:'bid', 'sale', '{"payment_method":"cash","total_minor":10000}');
select public.start_intervention(:'bid', 'Record every day', 'sales_30', 7) as iid \gset
select is((select baseline_value from public.interventions where id = :'iid'), 10000::numeric, 'baseline is captured when the plan starts');
select throws_ok($$ select public.start_intervention('00000000-0000-0000-0000-000000000000', 'x plan', 'sales_30') $$, '42501', null, 'strangers cannot start plans');
select throws_ok(format($$ select public.start_intervention(%L, 'bad metric', 'profit') $$, :'bid'), '22023', null, 'only catalogued metrics');
select public.give_pulse_feedback(:'bid', 'sales_momentum', current_date, 'accurate');
select is((select user_role::text from public.pulse_feedback), 'owner', 'feedback records who gave it');

select public.record_entry(:'bid', 'sale', '{"payment_method":"cash","total_minor":25000}');
select public.complete_intervention(:'iid');
select is((select count(*)::int from public.jobs where dedupe_key = 'outcome:' || :'iid'), 1, 'completion schedules outcome measurement');

-- Worker measures (service role) — emulate the job's insert.
reset role; set local role service_role;
insert into public.outcomes (intervention_id, business_id, metric, baseline_value, observed_value, delta, improved, window_start, window_end)
values (:'iid', :'bid', 'sales_30', 10000, 35000, 25000, true, now() - interval '7 days', now()) returning id as oid \gset

set local role authenticated;
select throws_ok(format($$ select public.verify_outcome(%L, 'verified') $$, :'oid'), '42501', null, 'owners cannot verify their own outcomes');
select pg_temp.login('00000000-0000-0000-0000-0000000000b9');
select lives_ok(format($$ select public.verify_outcome(%L, 'verified', 'Checked the notebook') $$, :'oid'), 'program operator verifies the outcome');
select is((select verifier_role::text from public.outcomes where id = :'oid'), 'program_admin', 'verifier role is recorded');

reset role; set local role service_role;
select is(jsonb_array_length(public.passport_facts(:'bid') -> 'verified_outcomes'), 1, 'verified outcomes appear on the Passport');

set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-0000000000a9');
select ok((public.activation_status(:'bid') ->> 'first_verified_outcome') is not null, 'activation tracks the verified outcome');
select ok((public.activation_status(:'bid') ->> 'first_intervention') is not null, 'activation tracks the first plan');

select * from finish();
rollback;
