begin;
create extension if not exists pgtap with schema extensions;
-- Single-admin path (dual approval itself is certified in 39_hardening).
update public.platform_settings set value = 'false' where key = 'dual_approval';
select plan(14);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000a031', 'owner@b31.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000b031', 'admin@b31.test', 'authenticated', 'authenticated');
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-00000000b031');
create function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000a031');
select public.create_business('Tomato Stall', 'Fresh produce', 'GH', 'GHS') as bid \gset
select throws_ok(format($$ select public.record_pack_entry(%L, 'fresh_produce', 'waste_log', '{"product":"Tomatoes","quantity":5,"reason":"spoiled"}') $$, :'bid'),
  'P0001', null, 'pack entities need the pack turned on');
select public.activate_pack(:'bid', 'fresh_produce');
select is(public.pack_pulse(:'bid') -> 0 ->> 'state', 'unknown', 'no data → unknown, not healthy');

select public.record_entry(:'bid', 'stock_movement', '{"product_name":"Tomatoes","quantity_delta":100,"reason":"purchase"}');
select throws_ok(format($$ select public.record_pack_entry(%L, 'fresh_produce', 'waste_log', '{"product":"Tomatoes","quantity":-1,"reason":"spoiled"}') $$, :'bid'),
  '22023', null, 'field rules from configuration are enforced');
select throws_ok(format($$ select public.record_pack_entry(%L, 'fresh_produce', 'waste_log', '{"product":"Tomatoes","quantity":3,"reason":"stolen"}') $$, :'bid'),
  '22023', null, 'enum values are enforced');
select public.record_pack_entry(:'bid', 'fresh_produce', 'waste_log', '{"product":"Tomatoes","quantity":20,"reason":"spoiled","extra":"dropped"}');
select is((select data ? 'extra' from public.vertical_records where business_id = :'bid'), false, 'only configured fields are stored');

select is((select (x ->> 'value')::numeric from jsonb_array_elements(public.pack_pulse(:'bid')) x where x ->> 'metric' = 'pack:fresh_produce:spoilage_rate'), 0.2000,
  'spoilage = waste ÷ stock bought');
select is((select x ->> 'state' from jsonb_array_elements(public.pack_pulse(:'bid')) x where x ->> 'metric' = 'pack:fresh_produce:spoilage_rate'), 'at_risk',
  'configured Pulse thresholds decide the state');

-- Pack metrics are first-class plan targets (B11) with a configured direction.
select public.start_intervention(:'bid', 'Cut spoilage', 'pack:fresh_produce:spoilage_rate', 14,
  null, (select v.id from public.solution_versions v join public.solutions s on s.id = v.solution_id where s.key = 'reduce_spoilage')) as iid \gset
select is((select expected_direction || ':' || baseline_value from public.interventions where id = :'iid'), 'down:0.2000', 'baseline and direction come from the pack');
reset role;
select is(public.measure_metric(:'bid', 'pack:fresh_produce:spoilage_rate'), 0.2000, 'the worker measures pack metrics');
set local role authenticated;

select is(public.pack_benchmark(:'bid', 'pack:fresh_produce:spoilage_rate') ->> 'median', null, 'no comparison with fewer than 10 businesses');

-- Workflows run under the owner's autonomy.
reset role;
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select is(public.run_pack_workflows(:'bid'), 0, 'a waste log today satisfies the daily workflow');
reset role;
update public.vertical_records set occurred_at = now() - interval '2 days' where business_id = :'bid';
set local role service_role;
select is(public.run_pack_workflows(:'bid'), 1, 'a missed day creates a reminder');

-- New verticals are configuration, validated.
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000b031');
select throws_ok($$ select public.upsert_pack('tailoring', 'Tailors', '{"entities":{},"metrics":{"x":{"direction":"up","numerator":{"source":"pg_authid"}}},"pulse":[]}') $$,
  '22023', null, 'unsupported metric sources are rejected');
select lives_ok($$ select public.upsert_pack('tailoring', 'Tailors', '{"entities":{"order":{"fields":{"garment":{"type":"text","required":true}}}},
  "metrics":{"orders_30":{"direction":"up","type":"value","numerator":{"source":"vertical_records","entity":"order","measure":"count"}}},"pulse":[]}') $$,
  'a second vertical is added by configuration only');

select * from finish();
rollback;
