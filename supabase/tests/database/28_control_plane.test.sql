begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000a030', 'owner@b30.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000b030', 'admin@b30.test', 'authenticated', 'authenticated');
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-00000000b030');
create function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000a030');
select public.create_business('Control Shop') as bid \gset
reset role;
-- Real signals: a dead-lettered job and a business at risk.
insert into public.jobs (type, status, last_error, payload) values ('test.flaky', 'dead', 'boom', '{}');
update public.businesses set created_at = now() - interval '20 days' where id = :'bid';

set local role authenticated;
select throws_ok($$ select public.control_plane() $$, '42501', null, 'the control plane is platform-admin only');
select pg_temp.login('00000000-0000-0000-0000-00000000b030');
select public.scan_retention();
select public.detect_incidents();
select is((select count(*)::int from public.incidents where fingerprint = 'jobs:dead:test.flaky' and status = 'open'), 1, 'a dead-lettered job opens an incident');
select public.detect_incidents();
select is((select count(*)::int from public.incidents where fingerprint = 'jobs:dead:test.flaky'), 1, 'detection is idempotent');

select ok(public.control_plane() -> 'areas' ?& array['growth', 'retention', 'operators', 'partners', 'solutions', 'outcomes', 'data_quality', 'automation', 'economics', 'incidents', 'policy'],
  'every operating area is covered');
select is(public.control_plane() -> 'status' ->> 'incidents', 'amber', 'status reflects open incidents');
select ok(exists (select 1 from jsonb_array_elements(public.control_plane() -> 'required_interventions') a where a ->> 'area' = 'retention'),
  'at-risk businesses surface as a required intervention');
select ok((public.control_plane() -> 'areas' -> 'incidents' -> 'open' -> 0 ->> 'title') like '%test.flaky%', 'incidents list what is failing');

select id as iid from public.incidents where fingerprint = 'jobs:dead:test.flaky' \gset
select public.acknowledge_incident(:'iid');
select is((select status from public.incidents where id = :'iid'), 'acknowledged', 'incidents can be acknowledged');

-- The signal clears → the incident resolves itself.
reset role;
update public.jobs set status = 'succeeded' where type = 'test.flaky';
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000b030');
select ok((public.detect_incidents() ->> 'resolved')::int >= 1, 'cleared signals resolve');
select is((select status from public.incidents where id = :'iid'), 'resolved', 'the incident is resolved, not deleted');
select is(public.control_plane() -> 'status' ->> 'incidents', 'green', 'status returns to green');

select * from finish();
rollback;
