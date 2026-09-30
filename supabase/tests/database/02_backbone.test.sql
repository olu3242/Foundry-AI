begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner@example.com', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b1', 'other@example.com', 'authenticated', 'authenticated');

create function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
select public.create_business('Owner Co') as bid \gset
select is((select count(*)::int from public.events where business_id = :'bid' and type in ('business.created', 'member.added')), 2,
  'business creation emits business.created and member.added');
select is((select actor_type::text from public.events where type = 'business.created'), 'user', 'events record the acting user');
select is((select count(*)::int from public.audit_log where business_id = :'bid'), 2, 'owner sees audit rows');
select throws_ok($$ insert into public.events (business_id, type) values ('00000000-0000-0000-0000-000000000000', 'x.y') $$,
  '42501', null, 'users cannot write events directly');
select throws_ok($$ select public.enqueue_job('test.noop') $$, '42501', null, 'users cannot enqueue jobs');
select throws_ok($$ select * from public.idempotency_keys $$, '42501', null, 'idempotency keys are service-only');

select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
select is((select count(*)::int from public.events), 0, 'other tenants see no events');
select is((select count(*)::int from public.audit_log), 0, 'other tenants see no audit rows');

reset role;
set local role service_role;
select public.enqueue_job('test.noop', :'bid', '{"n":1}', 'dedupe-1') as job1 \gset
select is(public.enqueue_job('test.noop', :'bid', '{"n":2}', 'dedupe-1'), :'job1'::uuid, 'dedupe key returns the active job');
select is((select count(*)::int from public.claim_jobs('w1', 10)), 1, 'claim returns the ready job');
select is((select count(*)::int from public.claim_jobs('w2', 10)), 0, 'a claimed job is not claimed twice');
select is(public.fail_job(:'job1', 'boom')::text, 'queued', 'failed job is requeued while attempts remain');
select ok((select run_at > now() from public.jobs where id = :'job1'), 'requeued job is delayed by backoff');
update public.jobs set run_at = now(), attempts = max_attempts - 1 where id = :'job1';
select is((select count(*)::int from public.claim_jobs('w1', 10)), 1, 'retry is claimable once due');
select is(public.fail_job(:'job1', 'boom again')::text, 'dead', 'job is dead-lettered after max attempts');
select is((select count(*)::int from public.events where type = 'job.dead' and entity_id = :'job1'), 1, 'dead jobs emit job.dead');

select results_eq(
  $$ select public.hit_rate_limit('k', 2, 60) from generate_series(1, 3) $$,
  $$ values (true), (true), (false) $$,
  'rate limiter allows up to the limit per window');

select * from finish();
rollback;
