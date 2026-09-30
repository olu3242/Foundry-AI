begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000a028', 'owner@b28.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000b028', 'admin@b28.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000c028', 'prog@b28.test', 'authenticated', 'authenticated');
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-00000000b028');
insert into public.solutions (key, name, summary, target_dimension, target_metric, default_window_days, status, pricing_model, price_minor, currency)
values ('paid_coaching', 'Paid coaching', 'Weekly coaching', 'sales', 'sales_30', 30, 'active', 'fixed', 5000, 'USD');
insert into public.solution_versions (solution_id, version, playbook) select id, 1, '[]' from public.solutions where key = 'paid_coaching';
select v.id as paid_v from public.solution_versions v join public.solutions s on s.id = v.solution_id where s.key = 'paid_coaching' \gset
create function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000a028');
select public.create_business('Lagos Shop', null, 'NG', 'NGN') as ng \gset
select public.create_business('Accra Shop', null, 'GH', 'GHS') as gh \gset
select throws_ok($$ select public.save_policy('solution.start', 'global', null, '{"default":"allow"}') $$, '42501', null, 'only platform admins write policy');

select pg_temp.login('00000000-0000-0000-0000-00000000b028');
select throws_ok($$ select public.save_policy('solution.start', 'global', null, '{"rules":[{"then":"maybe"}]}') $$, '22023', null, 'invalid rule results are rejected');
select public.save_policy('solution.start', 'market', 'NG',
  '{"rules":[{"if":{"field":"pricing_model","op":"!=","value":"free"},"then":"deny","reason":"Paid plans are paused in this market"}]}', 'v1') as p1 \gset
select public.activate_policy(:'p1');
select public.save_policy('ai.autonomy', 'market', 'GH', '{"rules":[{"if":{"field":"action_type","op":"=","value":"ops.record_request"},"then":"cap:2","reason":"Owner approval required for reminders in GH"}]}') as p2 \gset
select public.activate_policy(:'p2');

-- Same workflow, different market policy.
select pg_temp.login('00000000-0000-0000-0000-00000000a028');
select is(public.check_policy('solution.start', :'ng', jsonb_build_object('solution_version_id', :'paid_v')) ->> 'result', 'deny', 'pre-check explains the denial');
select throws_like(format($$ select public.start_intervention(%L, 'Coach', 'sales_30', 30, null, %L) $$, :'ng', :'paid_v'), 'Paid plans are paused%', 'NG policy denies paid solutions');
select lives_ok(format($$ select public.start_intervention(%L, 'Coach', 'sales_30', 30, null, %L) $$, :'gh', :'paid_v'), 'the same action is allowed in GH');
select lives_ok(format($$ select public.start_intervention(%L, 'Free plan', 'sales_30', 30) $$, :'ng'), 'free plans still start in NG');

reset role;
select is((select result from public.policy_decisions where business_id = :'ng' and policy_key = 'solution.start' order by id limit 1), 'deny', 'decision recorded with result');
select ok((select version = 1 and reason like 'Paid plans%' and input ->> 'pricing_model' = 'fixed' and scope = 'market:NG'
           from public.policy_decisions where business_id = :'ng' and policy_key = 'solution.start' order by id limit 1), 'decision records version, reason, input and scope');

-- AI autonomy ceiling changes routine ops by market.
insert into public.events (business_id, type, actor_type, occurred_at) values (:'ng', 'sale.recorded', 'user', now() - interval '5 days'), (:'gh', 'sale.recorded', 'user', now() - interval '5 days');
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select public.run_routine_ops(:'ng');
select public.run_routine_ops(:'gh');
reset role;
select is((select status::text from public.agent_actions where business_id = :'ng' and action_type = 'ops.record_request'), 'executed', 'NG: reminder runs automatically');
select is((select status::text || ':' || autonomy_level from public.agent_actions where business_id = :'gh' and action_type = 'ops.record_request'), 'proposed:2', 'GH: policy caps it to approval');

-- Versioning.
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000b028');
select public.save_policy('solution.start', 'market', 'NG', '{"default":"allow"}', 'v2: reopened') as p3 \gset
select public.activate_policy(:'p3');
select is((select status from public.policies where id = :'p1'), 'retired', 'activating v2 retires v1');
select is((select version from public.policies where id = :'p3'), 2, 'versions increment');
select is(public.simulate_policy('solution.start', '{"market":"NG","pricing_model":"fixed"}') ->> 'result', 'allow', 'v2 now allows');
select is((select count(*)::int from public.policy_decisions where policy_id = :'p3'), 0, 'simulation does not record');

-- Escalation parameters per program.
select public.save_policy('escalation.record_requests', 'global', null, '{"params":{"threshold":2}}') as p4 \gset
select public.activate_policy(:'p4');
reset role;
select is(private.escalation_threshold(:'gh'), 2, 'escalation threshold comes from policy');

select * from finish();
rollback;
