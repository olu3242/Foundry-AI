begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

insert into auth.users (id, email, phone, aud, role) values
  ('00000000-0000-0000-0000-00000000a045', 'owner@b45.test', '233240000045', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000c045', 'owner2@b45.test', '234800000045', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000b045', 'admin@b45.test', null, 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000d045', 'other@b45.test', null, 'authenticated', 'authenticated');
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-00000000b045');
create function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- Test vs real
update public.platform_settings set value = '"local"' where key = 'environment';
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000a045');
select public.create_business('Local Demo', null, 'GH', 'GHS') as demo \gset
reset role;
select is((select data_class from public.businesses where id = :'demo'), 'test', 'outside production every business is test data');
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000b045');
select throws_ok(format($$ select public.set_business_data_class(%L, 'real', 'promote demo') $$, :'demo'), 'P0001', null, 'test data can never be promoted to real outside production');
reset role;
update public.platform_settings set value = '"production"' where key = 'environment';
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000a045');
select public.create_business('Real Stall', 'Fresh produce', 'GH', 'GHS') as bid \gset
select pg_temp.login('00000000-0000-0000-0000-00000000c045');
select public.create_business('Lagos Stall', 'Fresh produce', 'NG', 'NGN') as ng \gset
reset role;
select is((select data_class from public.businesses where id = :'bid'), 'real', 'production businesses are real');

-- Configuration
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000b045');
select public.create_program('Cedi Pilot Program', 'Test Bank', null) as prog \gset
select join_code as code from public.programs where id = :'prog' \gset
select throws_ok(format($$ select public.save_pilot('{"name":"Bad","program_id":"%s","target_size":10,"starts_on":"2026-10-01","ends_on":"2026-12-30","success_metrics":[{"key":"vanity","target":1}]}') $$, :'prog'),
  '22023', null, 'success metrics come from the supported set');
select public.save_pilot(jsonb_build_object('name', 'Ghana produce pilot', 'program_id', :'prog', 'country_code', 'GH', 'target_size', 40,
  'starts_on', current_date - 1, 'ends_on', current_date + 89, 'escalation_days', 5,
  'success_metrics', '[{"key":"activation_rate","target":0.6},{"key":"verified_outcomes","target":1}]'::jsonb,
  'checkpoints', '[{"day":0,"label":"Kick-off"},{"day":30,"label":"Mid-point review"}]'::jsonb)) as pid \gset
select public.save_pilot(jsonb_build_object('id', :'pid', 'status', 'active'));
select is((select pilot_seats from public.programs where id = :'prog'), 40, 'the pilot size lifts the program''s free seat cap');
select is(public.invite_to_pilot(:'pid', array['+233 24 000 0045', '233240000045', 'bad']), 1, 'invites are deduplicated and validated');
reset role;

-- Cohort: consented enrollment joins the pilot, with eligibility.
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000a045');
select public.join_program(:'bid', :'code', true);
select pg_temp.login('00000000-0000-0000-0000-00000000c045');
select public.join_program(:'ng', :'code', true);
reset role;
select is((select stage || ':' || eligible from public.pilot_businesses where pilot_id = :'pid' and business_id = :'bid'), 'onboarded:true', 'consented enrollment → onboarded');
select is((select ineligible_reason from public.pilot_businesses where pilot_id = :'pid' and business_id = :'ng'), 'outside the pilot market', 'eligibility from configuration');
select is((select accepted_at is not null from public.pilot_invites where pilot_id = :'pid'), true, 'the invite is matched to the owner''s phone');

-- Stages from live data
insert into public.events (business_id, type, occurred_at) select :'bid', 'sale.recorded', now() - make_interval(hours => g) from generate_series(1, 3) g;
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select is(public.advance_pilots() ->> 'moved', '1', 'the worker advances stages');
reset role;
select is((select stage from public.pilot_businesses where pilot_id = :'pid' and business_id = :'bid'), 'activated', '3 records → activated');
insert into public.events (business_id, type, occurred_at) select :'bid', 'expense.recorded', now() - make_interval(days => g) from generate_series(1, 4) g;
insert into public.interventions (business_id, title, target_metric, expected_direction, baseline_value, due_at, created_by, created_by_role)
values (:'bid', 'Cut spoilage', 'sales_30', 'up', 100, now() + interval '14 days', '00000000-0000-0000-0000-00000000a045', 'owner') returning id as iid \gset
set local role service_role;
select public.advance_pilots();
reset role;
select is((select stage from public.pilot_businesses where pilot_id = :'pid' and business_id = :'bid'), 'intervention', 'a plan started in the pilot → intervention');
insert into public.outcomes (intervention_id, business_id, metric, baseline_value, observed_value, delta, improved, window_start, window_end, status)
values (:'iid', :'bid', 'sales_30', 100, 130, 30, true, now() - interval '14 days', now(), 'verified');
delete from public.events where business_id = :'bid' and type = 'sale.recorded';
set local role service_role;
select public.advance_pilots();
reset role;
select is((select stage || ':' || jsonb_array_length(history) from public.pilot_businesses where pilot_id = :'pid' and business_id = :'bid'), 'outcome:4',
  'stages only move forward, with history');

-- Stalled → escalation to the program team
update public.events set occurred_at = now() - interval '10 days' where business_id = :'bid';
set local role service_role;
select public.advance_pilots();
reset role;
select is((select at_risk from public.pilot_businesses where pilot_id = :'pid' and business_id = :'bid'), true, 'no activity past the escalation window → at risk');
select is((select kind || ':' || program_id from public.escalations where business_id = :'bid' and kind = 'pilot_stalled'), 'pilot_stalled:' || :'prog', 'escalated to the program');

-- Report: only real businesses count
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000d045');
select throws_ok(format($$ select public.pilot_report(%L) $$, :'pid'), '42501', null, 'outsiders cannot read a pilot');
select pg_temp.login('00000000-0000-0000-0000-00000000b045');
select is((select jsonb_agg(x ->> 'met') from jsonb_array_elements(public.pilot_report(:'pid') -> 'success_metrics') x), '["true", "true"]'::jsonb,
  'success metrics evaluated on real businesses');
select is((public.pilot_report(:'pid') -> 'evidence' ->> 'requirements_met')::boolean, true, 'evidence requirements from configuration');

select * from finish();
rollback;
