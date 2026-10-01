begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email, phone, aud, role) values
  ('00000000-0000-0000-0000-00000000a052', 'owner@b52.test', '233240000052', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000c052', 'owner2@b52.test', '233240000053', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000b052', 'admin@b52.test', null, 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000e052', 'op1@b52.test', '233240000054', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000f052', 'op2@b52.test', '233240000055', 'authenticated', 'authenticated');
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-00000000b052');
create function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000b052');
select public.create_program('Field Ops Program', null, null) as prog \gset
select join_code as code from public.programs where id = :'prog' \gset
select public.save_pilot(jsonb_build_object('name', 'Field ops pilot', 'program_id', :'prog', 'target_size', 10,
  'starts_on', current_date - 1, 'ends_on', current_date + 60)) as pid \gset
select public.save_pilot(jsonb_build_object('id', :'pid', 'status', 'active'));
select public.add_pilot_operator(:'pid', 'op1@b52.test', 'operator');
select public.add_pilot_operator(:'pid', 'op2@b52.test', 'operator');

select pg_temp.login('00000000-0000-0000-0000-00000000a052');
select public.create_business('Stall One', null, 'GH', 'GHS') as b1 \gset
select public.join_program(:'b1', :'code', true);
select pg_temp.login('00000000-0000-0000-0000-00000000c052');
select public.create_business('Stall Two', null, 'GH', 'GHS') as b2 \gset
select public.join_program(:'b2', :'code', true);
reset role;

-- B52: QUALIFY → ASSIGN OPERATOR → BASELINE on entry
select is((select count(*)::int from public.pilot_businesses where pilot_id = :'pid' and qualified_at is not null and baseline is not null), 2, 'entrants are qualified and baselined');
select is((select count(distinct operator_id)::int from public.pilot_businesses where pilot_id = :'pid'), 2, 'operators assigned by least load (one each)');
select ok((select baseline ? 'sales_30' and baseline ->> 'currency' = 'GHS' from public.pilot_businesses where pilot_id = :'pid' and business_id = :'b1'), 'baseline carries metrics in native currency');
select operator_id as op_b1 from public.pilot_businesses where pilot_id = :'pid' and business_id = :'b1' \gset

-- B53: one operational surface, scoped to the operator
insert into public.escalations (business_id, program_id, kind, reason, dedupe_key) values (:'b1', :'prog', 'pilot_stalled', 'quiet', 'b53:esc') returning id as esc \gset
set local role authenticated;
select pg_temp.login(:'op_b1');
select is(jsonb_array_length(public.operator_portfolio(:'pid')), 1, 'an operator sees only their portfolio');
select is((public.operator_portfolio(:'pid') -> 0 ->> 'open_escalations')::int, 1, 'portfolio lists the attention item');
select pg_temp.login('00000000-0000-0000-0000-00000000a052');
select throws_ok(format($$ select public.log_operator_touch(%L, %L, 'call', 10) $$, :'pid', :'b1'), '42501', null, 'only pilot operators log touches');
select pg_temp.login(:'op_b1');
select throws_ok(format($$ select public.log_operator_touch(%L, gen_random_uuid(), 'call', 10) $$, :'pid'), 'P0002', null, 'touches only for pilot businesses');
select lives_ok(format($$ select public.log_operator_touch(%L, %L, 'escalation', 15, 'Called the owner', %L) $$, :'pid', :'b1', :'esc'), 'operator resolves an escalation with a logged touch');
select public.log_operator_touch(:'pid', :'b1', 'record_help', 5);
reset role;
select is((select status from public.escalations where id = :'esc'), 'resolved', 'the escalation closes through the touch');

-- AI-resolved work comes from executed routine automation
insert into public.agent_actions (business_id, autonomy_level, action_type, title, payload, source, status)
values (:'b2', 4, 'ops.other', 'Catch up', '{}', 'ops-automation', 'executed');
select is((private.pilot_operations(:'pid') ->> 'ai_resolved')::int, 1, 'AI-resolved work is counted');
select is((private.pilot_operations(:'pid') ->> 'operator_minutes')::int, 20, 'operator minutes are summed');
select is((private.pilot_operations(:'pid') ->> 'businesses_per_operator')::numeric, 1.0, 'load per operator');

select * from finish();
rollback;
