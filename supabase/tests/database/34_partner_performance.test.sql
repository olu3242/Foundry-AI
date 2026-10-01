begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000a036', 'owner@b36.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000b036', 'admin@b36.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000c036', 'prog@b36.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000a1036', 'fast@b36.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000b2036', 'slow@b36.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000d036', 'other@b36.test', 'authenticated', 'authenticated');
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-00000000b036');
create function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000c036');
select public.create_program('Routing Program') as pid \gset
select join_code as code from public.programs where id = :'pid' \gset
select pg_temp.login('00000000-0000-0000-0000-00000000a036');
select public.create_business('Routed Shop') as bid \gset
select public.join_program(:'bid', :'code', true);
select public.start_intervention(:'bid', 'Plan', 'sales_30', 7) as iid \gset
select public.complete_intervention(:'iid');
reset role;
insert into public.program_members (program_id, user_id, role) values
  (:'pid', '00000000-0000-0000-0000-0000000a1036', 'partner'), (:'pid', '00000000-0000-0000-0000-0000000b2036', 'partner');
-- The fast partner verified a result 2 hours after it was measured.
insert into public.outcomes (intervention_id, business_id, metric, baseline_value, observed_value, delta, improved, window_start, window_end, status, measured_at, verified_at, verified_by)
values (:'iid', :'bid', 'sales_30', 1, 2, 1, true, now() - interval '9 days', now() - interval '5 days', 'verified', now() - interval '5 days', now() - interval '5 days' + interval '2 hours',
        '00000000-0000-0000-0000-0000000a1036');

set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000d036');
select throws_ok(format($$ select public.partner_performance(90, %L) $$, :'pid'), '42501', null, 'only program or platform admins see partner performance');
select pg_temp.login('00000000-0000-0000-0000-00000000c036');
select public.set_partner_capabilities(:'pid', '00000000-0000-0000-0000-0000000a1036', array['verification']);
select is((select (p ->> 'verify_turnaround_hours')::numeric from jsonb_array_elements(public.partner_performance(90, :'pid') -> 'program_partners') p
           where p ->> 'user_id' = '00000000-0000-0000-0000-0000000a1036'), 2.0, 'turnaround measured from real verifications');
select is(public.partner_performance(90, :'pid') -> 'providers', 'null'::jsonb, 'program admins only see their own partners');
select ok(public.partner_performance(90, :'pid') ->> 'note' like 'For governance and routing only%', 'internal use is explicit, not a public ranking');
select is((select (c ->> 'user_id') from jsonb_array_elements(public.route_candidates(:'pid')) c where (c ->> 'chosen')::boolean), '00000000-0000-0000-0000-0000000a1036',
  'routing prefers documented capability and a fast track record');

-- Load matters: a busy partner yields to an available one.
reset role;
insert into public.businesses (id, name, country_code, currency, created_by) select gen_random_uuid(), 'Load ' || g, 'GH', 'GHS', '00000000-0000-0000-0000-00000000a036' from generate_series(1, 20) g;
insert into public.program_enrollments (program_id, business_id, consented_at) select :'pid', id, now() from public.businesses where name like 'Load %';
insert into public.partner_assignments (program_id, partner_user_id, business_id) select :'pid', '00000000-0000-0000-0000-0000000a1036', id from public.businesses where name like 'Load %';
select is(private.best_partner(:'pid', 'verification'), '00000000-0000-0000-0000-0000000b2036'::uuid, 'load rebalances routing');

-- Routine ops (B23) route through the same documented score.
update public.programs set auto_route = true where id = :'pid';
update public.outcomes set status = 'observed', verified_at = null, verified_by = null, measured_at = now() - interval '4 days' where intervention_id = :'iid';
set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select is((public.run_routine_ops(:'bid') ->> 'routed')::int, 1, 'auto-routing assigns a partner');
reset role;
select is((select partner_user_id from public.partner_assignments where program_id = :'pid' and business_id = :'bid'), '00000000-0000-0000-0000-0000000b2036'::uuid,
  'the documented score picked the partner');
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000b036');
select ok(public.partner_performance(90) ? 'verifiers', 'platform admins see providers and verifiers too');

select * from finish();
rollback;
