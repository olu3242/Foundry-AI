begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000a034', 'owner@b34.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000d034', 'other@b34.test', 'authenticated', 'authenticated');
create function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000a034');
select public.create_business('Playbook Shop') as bid \gset
select public.record_entry(:'bid', 'sale', '{"total_minor":5000,"payment_method":"credit","amount_paid_minor":1000}');
reset role;
insert into public.pulse_snapshots (business_id, computed_on, dimension, state, why) values (:'bid', current_date, 'cash_flow', 'at_risk', 'Little cash came in');
set local role authenticated;

select ok(public.suggest_playbooks(:'bid') @> '[{"key":"cash_crunch"}]', 'a detected problem suggests the matching playbook');
select pg_temp.login('00000000-0000-0000-0000-00000000d034');
select throws_ok(format($$ select public.launch_playbook(%L, 'cash_crunch') $$, :'bid'), '42501', null, 'only the business launches playbooks');
select pg_temp.login('00000000-0000-0000-0000-00000000a034');
select public.launch_playbook(:'bid', 'cash_crunch') as run \gset
select is((select count(*)::int from public.interventions i join public.solution_versions v on v.id = i.solution_version_id join public.solutions s on s.id = v.solution_id
           where i.business_id = :'bid' and s.key = 'collect_overdue' and i.status = 'active'), 1, 'step 1 runs as a normal plan using the existing solution');
select ok(not (public.suggest_playbooks(:'bid') @> '[{"key":"cash_crunch"}]'), 'a running playbook is not suggested again');
select throws_ok(format($$ select public.launch_playbook(%L, 'cash_crunch') $$, :'bid'), '23505', null, 'one run per playbook at a time');

select intervention_id as s1 from public.playbook_run_steps where run_id = :'run' and step_no = 1 \gset
select public.complete_intervention(:'s1');
select is((select status from public.playbook_run_steps where run_id = :'run' and step_no = 1), 'passed', 'the gate passes when the step completes');
select is((select current_step from public.playbook_runs where id = :'run'), 2, 'the next step starts automatically');
select ok((select i.status = 'active' from public.playbook_run_steps st join public.interventions i on i.id = st.intervention_id where st.run_id = :'run' and st.step_no = 2),
  'step 2 is a live plan');

select intervention_id as s2 from public.playbook_run_steps where run_id = :'run' and step_no = 2 \gset
select public.record_entry(:'bid', 'sale', '{"total_minor":9000,"payment_method":"cash"}');
select public.complete_intervention(:'s2');
select is((select status from public.playbook_runs where id = :'run'), 'completed', 'the playbook completes after its last step');
select ok((select result ? 'baseline' and result ? 'observed' and (result ->> 'improved')::boolean from public.playbook_runs where id = :'run'),
  'and its own outcome is measured against the launch baseline');

-- Governance applies: an abandoned step ends the run.
select public.launch_playbook(:'bid', 'get_finance_ready') as run2 \gset
select intervention_id as f1 from public.playbook_run_steps where run_id = :'run2' and step_no = 1 \gset
select public.abandon_intervention(:'f1', 'no_time');
select is((select status || ':' || stop_reason from public.playbook_runs where id = :'run2'), 'abandoned:Step 1 was abandoned', 'abandoning a step ends the run with the reason');
select is((select count(*)::int from public.audit_log where table_name = 'playbook_runs' and business_id = :'bid') >= 4, true, 'runs are audited');

select * from finish();
rollback;
