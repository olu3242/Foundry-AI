begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000a022', 'owner@b22.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000b022', 'admin@b22.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000c022', 'op@b22.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000d022', 'other@b22.test', 'authenticated', 'authenticated');
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-00000000b022');
create function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000a022');
select public.create_business('Never Started') as b_new \gset
select public.create_business('Went Quiet') as b_quiet \gset
select public.create_business('Busy Shop') as b_busy \gset
select public.create_business('Paid Quiet') as b_paid \gset
select public.choose_plan(:'b_paid', 'growth');
select pg_temp.login('00000000-0000-0000-0000-00000000c022');
select public.create_program('Retention Program') as pid \gset
select join_code as code from public.programs where id = :'pid' \gset
select pg_temp.login('00000000-0000-0000-0000-00000000a022');
select public.join_program(:'b_quiet', :'code', true);

reset role;
update public.businesses set created_at = now() - interval '40 days' where id in (:'b_quiet', :'b_busy', :'b_paid');
update public.businesses set created_at = now() - interval '20 days' where id = :'b_new';
insert into public.events (business_id, type, actor_type, occurred_at)
select :'b_quiet'::uuid, 'sale.recorded', 'user', now() - (d || ' days')::interval from generate_series(20, 26) d;
insert into public.events (business_id, type, actor_type, occurred_at)
select :'b_paid'::uuid, 'sale.recorded', 'user', now() - interval '18 days';
insert into public.events (business_id, type, actor_type, occurred_at)
select :'b_busy'::uuid, 'sale.recorded', 'user', now() - (d || ' days')::interval from generate_series(0, 5) d;

set local role authenticated;
select throws_ok($$ select public.scan_retention() $$, '42501', null, 'only admins or the worker scan retention');
select pg_temp.login('00000000-0000-0000-0000-00000000b022');
select is((public.scan_retention() ->> 'opened')::int >= 3, true, 'scan opens recovery actions for at-risk businesses');
select is((select risk from public.business_health where business_id = :'b_busy'), 'healthy', 'active businesses are healthy');
select is((select count(*)::int from public.recovery_actions where business_id = :'b_busy'), 0, 'healthy businesses get no action');
select is((select action_type from public.recovery_actions where business_id = :'b_new'), 'onboarding_help', 'no first record → onboarding help');
select is((select action_type from public.recovery_actions where business_id = :'b_quiet'), 'owner_nudge', 'inactivity → owner nudge');
select ok((select (evidence -> 'reasons' -> 0 ->> 'days_inactive')::int >= 19 from public.recovery_actions where business_id = :'b_quiet'), 'actions carry their evidence');
select is((select action_type from public.recovery_actions where business_id = :'b_paid'), 'renewal_check', 'paid and at risk → renewal check');
select is((select continuation from public.business_health where business_id = :'b_paid'), 'at_risk', 'continuation risk is flagged for paying customers');
select is((public.scan_retention() ->> 'opened')::int, 0, 'scans are idempotent');

-- Operators see the evidence-backed item instead of a bare "inactive" one.
select pg_temp.login('00000000-0000-0000-0000-00000000c022');
select is((select array_agg(kind order by kind) from public.operator_queue() where business_id = :'b_quiet'), array['recovery'], 'recovery replaces the plain inactive item');
select id as ra from public.recovery_actions where business_id = :'b_quiet' \gset
select pg_temp.login('00000000-0000-0000-0000-00000000d022');
select throws_ok(format($$ select public.close_recovery_action(%L, 'done') $$, :'ra'), '42501', null, 'strangers cannot close actions');

-- Activity resumes → recovered.
reset role;
insert into public.events (business_id, type, actor_type) values (:'b_quiet', 'sale.recorded', 'user');
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000b022');
select is((public.scan_retention() ->> 'recovered')::int, 1, 'resumed activity closes the loop');
select is((public.retention_overview() -> 'recovery' -> (select idx - 1 from jsonb_array_elements(public.retention_overview() -> 'recovery') with ordinality t(x, idx) where x ->> 'action_type' = 'owner_nudge')::int ->> 'recovered')::int,
  1, 'recovery effectiveness is measured per action type');

select * from finish();
rollback;
