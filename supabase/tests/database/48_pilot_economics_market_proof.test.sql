begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

insert into auth.users (id, email, phone, aud, role) values
  ('00000000-0000-0000-0000-00000000a059', 'owner@b59.test', '233240000059', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000c059', 'owner2@b59.test', '233240000060', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000b059', 'admin@b59.test', null, 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000d059', 'other@b59.test', null, 'authenticated', 'authenticated');
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-00000000b059');
create function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

update public.platform_settings set value = '"local"' where key = 'environment';
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000b059');
select public.create_program('Economics Program', null, null) as prog \gset
select join_code as code from public.programs where id = :'prog' \gset
select public.save_pilot(jsonb_build_object('name', 'Economics pilot', 'program_id', :'prog', 'target_size', 5, 'starts_on', current_date - 1, 'ends_on', current_date + 30)) as pid \gset
select public.save_pilot(jsonb_build_object('id', :'pid', 'status', 'active'));
select pg_temp.login('00000000-0000-0000-0000-00000000a059');
select public.create_business('Test Stall', null, 'GH', 'GHS') as tb \gset
select public.join_program(:'tb', :'code', true);

-- Dashboard on test data: never a value, always INSUFFICIENT_EVIDENCE
select pg_temp.login('00000000-0000-0000-0000-00000000b059');
select is((public.pilot_dashboard(:'pid') ->> 'test_businesses_excluded')::int, 1, 'test businesses are excluded and counted separately');
select is(public.pilot_dashboard(:'pid') -> 'activated' ->> 'state', 'INSUFFICIENT_EVIDENCE', 'no real businesses → INSUFFICIENT_EVIDENCE');
select is(public.pilot_dashboard(:'pid') -> 'invited', '{"value": 0, "state": "0"}'::jsonb, 'a measured zero is 0, not unknown');
select is(public.market_proof_certification() ->> 'verdict', 'INSUFFICIENT_EVIDENCE', 'local data → INSUFFICIENT_EVIDENCE');
select is(jsonb_array_length(public.market_proof_certification() -> 'proofs'), 10, 'ten proofs evaluated');
select is((select count(*)::int from jsonb_array_elements(public.market_proof_certification() -> 'proofs') p where p ->> 'status' <> 'INSUFFICIENT_EVIDENCE'), 0,
  'every proof insufficient on test data');
reset role;

-- Production: one real business in the pilot
update public.platform_settings set value = '"production"' where key = 'environment';
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000c059');
select public.create_business('Real Stall', null, 'GH', 'GHS') as rb \gset
select public.join_program(:'rb', :'code', true);
select pg_temp.login('00000000-0000-0000-0000-00000000b059');
select is(public.pilot_dashboard(:'pid') -> 'activated', '{"value": 0, "state": "0"}'::jsonb, 'real business, not yet activated → 0');
select is(public.pilot_dashboard(:'pid') -> 'useful_pulse' ->> 'state', 'UNKNOWN', 'no Pulse ratings → UNKNOWN, not 0');
select is(public.pilot_dashboard(:'pid') -> 'cost_usd' ->> 'state', 'UNKNOWN', 'operator cost not configured → cost UNKNOWN');
select is(public.pilot_dashboard(:'pid') -> 'contribution_usd' ->> 'state', 'UNKNOWN', 'contribution UNKNOWN until costs and FX are known');
reset role;
update public.pilots set operator_hourly_cost_usd = 5 where id = :'pid';
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000b059');
select is(public.pilot_dashboard(:'pid') -> 'cost_usd' ->> 'state', '0', 'configured costs with no spend → measured 0');

-- Gap loop
select pg_temp.login('00000000-0000-0000-0000-00000000d059');
select throws_ok(format($$ select public.record_pilot_gap(%L, 'B54', null, 'Owners cannot photograph receipts at night', 'P2', 'operator notes') $$, :'pid'), '42501', null, 'outsiders cannot record gaps');
select pg_temp.login('00000000-0000-0000-0000-00000000b059');
select public.record_pilot_gap(:'pid', 'B52', :'rb', 'Join code SMS never arrives on one network', 'P1', 'three owners reported') as gap \gset
select throws_ok(format($$ select public.update_pilot_gap(%L, 'backlogged') $$, :'gap'), 'P0001', null, 'P0/P1 gaps cannot be backlogged');
select throws_ok(format($$ select public.update_pilot_gap(%L, 'resolved') $$, :'gap'), '22023', null, 'resolution required to close');
select lives_ok(format($$ select public.update_pilot_gap(%L, 'resolved', 'Sender ID blocked', 'Switched sender', 'Codes now delivered') $$, :'gap'), 'gap resolved with root cause and resolution');

-- A proof that fails its threshold fails the verdict; snapshots persist
reset role;
update public.platform_settings set value = jsonb_set(value, '{intelligence}', '{"min_n": 1, "proven": 0.6, "failed": 0.3}') where key = 'market_proof_thresholds';
insert into public.pulse_snapshots (business_id, computed_on, dimension, state, why) values (:'rb', current_date, 'cash_flow', 'at_risk', 'low cash');
insert into public.pulse_feedback (business_id, dimension, computed_on, verdict, user_id, user_role)
values (:'rb', 'cash_flow', current_date, 'inaccurate', '00000000-0000-0000-0000-00000000c059', 'owner');
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000b059');
select is(public.market_proof_certification() ->> 'verdict', 'FAILED', 'a failed proof fails the certification');
select public.certify_market_proof() as mp \gset
select is((select verdict from public.market_proof_certifications where id = :'mp'), 'FAILED', 'certification snapshot stored');
select pg_temp.login('00000000-0000-0000-0000-00000000d059');
select throws_ok($$ select public.market_proof_certification() $$, '42501', null, 'admins only');

-- The daily worker (service role) certifies both tracks (B50 fix).
reset role;
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select lives_ok($$ select public.certify_real_world() $$, 'worker can snapshot real-world certification');
select lives_ok($$ select public.certify_market_proof() $$, 'worker can snapshot market proof');

select * from finish();
rollback;
