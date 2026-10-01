begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email, phone, aud, role) values
  ('00000000-0000-0000-0000-00000000a054', 'owner@b54.test', '233240000056', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000b054', 'admin@b54.test', null, 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000e054', 'op@b54.test', '233240000057', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000d054', 'other@b54.test', null, 'authenticated', 'authenticated');
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-00000000b054');
create function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000b054');
select public.create_program('Capture Program', null, null) as prog \gset
select join_code as code from public.programs where id = :'prog' \gset
select public.save_pilot(jsonb_build_object('name', 'Capture pilot', 'program_id', :'prog', 'target_size', 5, 'starts_on', current_date - 1, 'ends_on', current_date + 30)) as pid \gset
select public.save_pilot(jsonb_build_object('id', :'pid', 'status', 'active'));
select public.add_pilot_operator(:'pid', 'op@b54.test', 'operator');
select pg_temp.login('00000000-0000-0000-0000-00000000a054');
select public.create_business('Maturity Stall', null, 'GH', 'GHS') as bid \gset
select public.join_program(:'bid', :'code', true);
reset role;

-- B54 record maturity: measured, never forced
select is(private.record_maturity(:'bid'), 'R0', 'no records → R0');
insert into public.events (business_id, type, occurred_at) values (:'bid', 'sale.recorded', now());
select is(private.record_maturity(:'bid'), 'R1', 'some records → R1');
insert into public.events (business_id, type, occurred_at) select :'bid', 'expense.recorded', now() - make_interval(days => g) from generate_series(1, 4) g;
select is(private.record_maturity(:'bid'), 'R2', 'records on ≥4 days in 30 → R2');
insert into public.sales (business_id, total_minor, amount_paid_minor, currency, provenance, created_by)
values (:'bid', 5000, 5000, 'GHS', 'document_backed', '00000000-0000-0000-0000-00000000a054');
select is(private.record_maturity(:'bid'), 'R3', 'regular + document-backed → R3');
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000b054');
select is(public.snapshot_record_maturity(), 1, 'daily maturity snapshot for pilot businesses');
reset role;

-- Capture channels: extraction, confirmation, manual vs operator assist; IMPORT/CONNECT are N/A
insert into public.captures (business_id, created_by, channel, raw_text, status) values
  (:'bid', '00000000-0000-0000-0000-00000000a054', 'voice', 'sold rice 50', 'resolved'),
  (:'bid', '00000000-0000-0000-0000-00000000a054', 'voice', 'mumble', 'failed');
insert into public.record_drafts (business_id, capture_id, kind, fields, confidence, status)
select :'bid', id, 'sale', '{}', 0.9, 'confirmed' from public.captures where business_id = :'bid' and status = 'resolved';
insert into public.sales (business_id, total_minor, amount_paid_minor, currency, created_by)
values (:'bid', 100, 100, 'GHS', '00000000-0000-0000-0000-00000000e054');
select is(private.capture_quality(array[:'bid'::uuid], array['00000000-0000-0000-0000-00000000e054'::uuid]) -> 'channels' -> 'SPEAK',
  '{"attempts": 2, "extracted": 1, "failed": 1}'::jsonb, 'voice channel: attempts, extracted, failed');
select is((private.capture_quality(array[:'bid'::uuid], array['00000000-0000-0000-0000-00000000e054'::uuid]) ->> 'extraction_success_rate')::numeric, 0.5000, 'extraction success rate');
select is(private.capture_quality(array[:'bid'::uuid], array['00000000-0000-0000-0000-00000000e054'::uuid]) -> 'channels' -> 'OPERATOR_ASSIST' ->> 'records', '1', 'operator-assisted records counted');
select is(private.capture_quality(array[:'bid'::uuid], array['00000000-0000-0000-0000-00000000e054'::uuid]) -> 'channels' ->> 'IMPORT', 'N/A', 'channels without a rail are N/A, not 0');

-- B55 Pulse calibration from feedback only
insert into public.pulse_snapshots (business_id, computed_on, dimension, state, why) values (:'bid', current_date, 'cash_flow', 'at_risk', 'low cash');
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000d054');
select throws_ok(format($$ select public.give_operator_pulse_feedback(%L, 'cash_flow', current_date, 'inaccurate') $$, :'bid'), '42501', null, 'only the pilot operator rates as operator');
select pg_temp.login('00000000-0000-0000-0000-00000000e054');
select public.give_operator_pulse_feedback(:'bid', 'cash_flow', current_date, 'inaccurate', 'Checked till', 'Cash was fine');
select pg_temp.login('00000000-0000-0000-0000-00000000a054');
select public.give_pulse_feedback(:'bid', 'stock_health', current_date, 'missed', 'Ran out of rice');
reset role;
select is((select given_as || ':' || verdict || ':' || action_taken from public.pulse_feedback where business_id = :'bid' and dimension = 'cash_flow'), 'operator:inaccurate:Checked till',
  'operator feedback keeps action taken');
select is((select x - 'dimension' from jsonb_array_elements(private.pulse_calibration(array[:'bid'::uuid])) x where x ->> 'dimension' = 'cash_flow'),
  '{"material_signals":1,"rated":1,"useful":0,"false_positive":1,"missed":0,"useful_rate":0.0000,"false_positive_rate":1.0000,"unrated":0}'::jsonb, 'false positive measured');
select is((select (x ->> 'missed')::int from jsonb_array_elements(private.pulse_calibration(array[:'bid'::uuid])) x where x ->> 'dimension' = 'stock_health'), 1, 'false negatives reported as missed');
select is((select count(*)::int from public.pulse_calibration(90) where dimension = 'stock_health'), 0, 'a miss never enters B16 accuracy');

select * from finish();
rollback;
