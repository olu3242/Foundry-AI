begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

select has_table('public', 'waitlist_signups', 'waitlist table exists');
select ok((select relrowsecurity from pg_class where oid = 'public.waitlist_signups'::regclass), 'RLS is enabled');
select ok(not has_table_privilege('anon', 'public.waitlist_signups', 'select'), 'anon cannot read signups');
select ok(not has_table_privilege('anon', 'public.waitlist_signups', 'insert'), 'anon cannot insert directly');
select ok(not has_table_privilege('authenticated', 'public.waitlist_signups', 'select'), 'signed-in users cannot read signups');
select ok(has_table_privilege('service_role', 'public.waitlist_signups', 'insert'), 'service role can store signups');

insert into public.waitlist_signups (role, contact, contact_hash, consented_at)
values ('Business owner', 'ama@example.com', repeat('a', 64), now());
insert into public.waitlist_signups (role, contact, contact_hash, consented_at)
values ('Business owner', 'ama@example.com', repeat('a', 64), now()) on conflict (contact_hash) do nothing;
select is((select count(*)::int from public.waitlist_signups where contact_hash = repeat('a', 64)), 1, 'contact hash makes retries idempotent');
select throws_ok($$ insert into public.waitlist_signups (role, contact, contact_hash, consented_at)
	values ('Developer', 'dev@example.com', repeat('b', 64), now()) $$,
	'23514', null, 'unknown roles are rejected');

select * from finish();
rollback;