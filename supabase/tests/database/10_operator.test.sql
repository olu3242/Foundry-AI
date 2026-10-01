begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000a010', 'op@ops.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000b010', 'o1@ops.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000c010', 'o2@ops.test', 'authenticated', 'authenticated');
create function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000a010');
select public.create_program('Ops Program') as pid \gset
select join_code as code from public.programs where id = :'pid' \gset
select pg_temp.login('00000000-0000-0000-0000-00000000b010');
select public.create_business('Quiet Shop') as b1 \gset
select public.join_program(:'b1', :'code', true);
select pg_temp.login('00000000-0000-0000-0000-00000000c010');
select public.create_business('Not Enrolled') as b2 \gset

select pg_temp.login('00000000-0000-0000-0000-00000000a010');
select is((select count(*)::int from public.operator_queue() where kind = 'inactive'), 1, 'inactive enrolled business appears in the queue');
select is((select count(*)::int from public.operator_queue() where business_id = :'b2'), 0, 'non-enrolled businesses never appear');
select is((public.operator_metrics() ->> 'businesses')::int, 1, 'portfolio size counts consented businesses');
select is((public.operator_metrics() ->> 'open_items')::int, 1, 'open items are tracked');

select public.snooze_items(array['inactive:' || :'b1'], 3);
select is((select count(*)::int from public.operator_queue()), 0, 'snoozed items leave the queue');
select is((public.operator_metrics() ->> 'resolved_30d')::int, 0, 'snoozing is not resolving');

select is(public.batch_nudge(array[:'b1', :'b2']::uuid[], 'Please record today''s sales'), 1, 'nudges reach only portfolio businesses');
select pg_temp.login('00000000-0000-0000-0000-00000000c010');
select is((select count(*)::int from public.agent_actions where business_id = :'b2'), 0, 'outsiders are not nudged');
select throws_ok(format($$ select public.batch_nudge(array[%L]::uuid[], 'x') $$, :'b1'), 'P0001', null, 'nudges need a real note');

select * from finish();
rollback;
