begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000a039', 'owner@b39.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000c039', 'bankadmin@b39.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000e039', 'analyst@b39.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000f039', 'delegate@b39.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000d039', 'other@b39.test', 'authenticated', 'authenticated');
create function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000c039');
select public.create_organization('Example Bank', 'bank') as org \gset
select public.create_program('Bank Program North') as p1 \gset
select public.create_program('Bank Program South') as p2 \gset
select join_code as code1 from public.programs where id = :'p1' \gset
select public.attach_program(:'org', :'p1');
select public.attach_program(:'org', :'p2');
select public.add_org_member(:'org', 'analyst@b39.test', 'analyst');
select pg_temp.login('00000000-0000-0000-0000-00000000a039');
select public.create_business('Enrolled Shop') as bid \gset
select public.create_business('Independent Shop') as other_bid \gset
select public.join_program(:'bid', :'code1', true);

-- Boundaries.
select pg_temp.login('00000000-0000-0000-0000-00000000d039');
select throws_ok(format($$ select public.org_report(%L) $$, :'org'), '42501', null, 'non-members see nothing');
select throws_ok(format($$ select public.attach_program(%L, %L) $$, :'org', :'p1'), '42501', null, 'attaching needs both admin roles');
select pg_temp.login('00000000-0000-0000-0000-00000000e039');
select is((public.org_report(:'org') -> 'totals' ->> 'enrolled')::int, 1, 'analysts see aggregated reporting across programs');
select is((select count(*)::int from public.businesses where id = :'bid'), 0, 'organization roles never grant access to a business');
select throws_ok(format($$ select public.org_sponsor_plan(%L, 'sponsored_growth') $$, :'org'), '42501', null, 'analysts cannot change entitlements');
select ok(public.org_report(:'org') ->> 'boundary' like 'Aggregates only%', 'the reporting boundary is explicit');

-- Delegated administration.
select pg_temp.login('00000000-0000-0000-0000-00000000c039');
select public.delegate_program_role(:'org', :'p2', 'delegate@b39.test', 'admin');
select pg_temp.login('00000000-0000-0000-0000-00000000f039');
select ok(private.is_program_member(:'p2', array['admin']::public.program_role[]), 'delegated admins administer the program');

-- Organization-wide entitlements.
select pg_temp.login('00000000-0000-0000-0000-00000000c039');
select is(public.org_sponsor_plan(:'org', 'sponsored_growth'), 1, 'one call sponsors every enrolled business across programs');
select pg_temp.login('00000000-0000-0000-0000-00000000a039');
select is(public.entitlement_status(:'bid') ->> 'paid_by', 'Bank Program North', 'the business sees who pays');

-- Organization-scoped policy applies to its programs only.
select pg_temp.login('00000000-0000-0000-0000-00000000c039');
select public.save_org_policy(:'org', 'solution.start', '{"rules":[{"if":{"field":"solution_id","op":"exists"},"then":"deny","reason":"Bank programs run their own curriculum"}]}');
select pg_temp.login('00000000-0000-0000-0000-00000000a039');
select v.id as push_v from public.solution_versions v join public.solutions s on s.id = v.solution_id where s.key = 'grow_sales_push' and v.status = 'active' order by version desc limit 1 \gset
select throws_like(format($$ select public.start_intervention(%L, 'Push', 'sales_30', 7, null, %L) $$, :'bid', :'push_v'), 'Bank programs run their own curriculum',
  'org policy governs businesses in its programs');
select lives_ok(format($$ select public.start_intervention(%L, 'Push', 'sales_30', 7, null, %L) $$, :'other_bid', :'push_v'), 'and nobody else');

select pg_temp.login('00000000-0000-0000-0000-00000000e039');
select ok((public.org_report(:'org') -> 'programs' -> 0 -> 'sla') ? 'verify_breaches', 'SLA telemetry per program');
reset role;
select is((select count(*)::int from public.audit_log where table_name = 'org_members') >= 2, true, 'membership changes are audited');

select * from finish();
rollback;
