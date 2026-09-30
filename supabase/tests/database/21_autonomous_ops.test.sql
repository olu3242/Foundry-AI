begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000a023', 'owner@b23.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000b023', 'admin@b23.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000c023', 'progadmin@b23.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000e023', 'partner@b23.test', 'authenticated', 'authenticated');
update public.profiles set email = 'partner@b23.test' where id = '00000000-0000-0000-0000-00000000e023';
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-00000000b023');
create function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000a023');
select public.create_business('Auto Shop') as bid \gset
select public.create_business('Quiet Owner') as bid2 \gset
insert into public.autonomy_policies (business_id, action_type, level) values (:'bid2', 'ops.record_request', 2);
select public.start_intervention(:'bid', 'Push sales', 'sales_30', 1) as iid \gset
select pg_temp.login('00000000-0000-0000-0000-00000000c023');
select public.create_program('Ops Program') as pid \gset
select join_code as code from public.programs where id = :'pid' \gset
select pg_temp.login('00000000-0000-0000-0000-00000000a023');
select public.join_program(:'bid', :'code', true);

reset role;
insert into public.events (business_id, type, actor_type, occurred_at) values
  (:'bid', 'sale.recorded', 'user', now() - interval '5 days'), (:'bid2', 'sale.recorded', 'user', now() - interval '5 days');
insert into public.program_members (program_id, user_id, role) values (:'pid', '00000000-0000-0000-0000-00000000e023', 'partner');
-- A measured result that has waited four days for verification.
insert into public.outcomes (intervention_id, business_id, metric, baseline_value, observed_value, delta, improved, window_start, window_end, status, measured_at)
values (:'iid', :'bid', 'sales_30', 0, 1, 1, true, now() - interval '8 days', now() - interval '4 days', 'observed', now() - interval '4 days');

set local role authenticated;
select throws_ok($$ select public.run_routine_ops() $$, '42501', null, 'only the worker or admins run routine ops');
select pg_temp.login('00000000-0000-0000-0000-00000000b023');
select public.run_routine_ops() as r1 \gset
reset role;
select is((select status::text from public.agent_actions where business_id = :'bid' and action_type = 'ops.record_request'), 'executed', 'level 4 default: routine request runs on its own');
select is((select payload -> 'authority' ->> 'policy' from public.agent_actions where business_id = :'bid' and action_type = 'ops.record_request'), 'default', 'authority is recorded');
select ok((select (payload -> 'evidence' ->> 'days_without_records')::int >= 4 from public.agent_actions where business_id = :'bid' and action_type = 'ops.record_request'), 'evidence is recorded');
select is((select status::text from public.agent_actions where business_id = :'bid2' and action_type = 'ops.record_request'), 'proposed', 'owner policy at level 2 waits for approval');
select is((select payload -> 'authority' ->> 'policy' from public.agent_actions where business_id = :'bid2' and action_type = 'ops.record_request'), 'owner', 'owner policy is honoured');
select is((select count(*)::int from public.agent_actions where business_id = :'bid' and action_type = 'ops.plan_reminder'), 1, 'plans ending soon get a reminder');
select is((select count(*)::int from public.escalations where business_id = :'bid' and kind = 'assign_verifier'), 1, 'without routing authority, verification escalates to the program');
set local role authenticated;
select is((public.run_routine_ops() ->> 'acted')::int, 0, 'routine ops are idempotent');

-- Operators see escalations for their programs.
select pg_temp.login('00000000-0000-0000-0000-00000000c023');
select is((select count(*)::int from public.operator_queue() where kind = 'escalation'), 1, 'escalation reaches the operator queue');
select public.set_program_auto_route(:'pid', true);
select pg_temp.login('00000000-0000-0000-0000-00000000b023');
select is((public.run_routine_ops() ->> 'routed')::int, 1, 'with program authority, verification is routed automatically');
reset role;
select is((select count(*)::int from public.partner_assignments where program_id = :'pid' and business_id = :'bid'), 1, 'least-loaded partner assigned');

-- Reversible.
select id as route_id from public.agent_actions where business_id = :'bid' and action_type = 'ops.route_verifier' \gset
set local role authenticated;
select throws_ok(format($$ select public.revert_ops_action(%L) $$, :'route_id'), '42501', null, 'only program admins undo routing');
select pg_temp.login('00000000-0000-0000-0000-00000000c023');
select public.revert_ops_action(:'route_id');
reset role;
select is((select count(*)::int from public.partner_assignments where program_id = :'pid' and business_id = :'bid'), 0, 'undo removes the assignment');
select is((select count(*)::int from public.audit_log where table_name = 'escalations' and business_id = :'bid'), 1, 'escalations are audited');

select * from finish();
rollback;
