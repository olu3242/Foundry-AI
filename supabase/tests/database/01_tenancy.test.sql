begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

-- Fixtures: two owners, one staff member, one outsider.
insert into auth.users (id, email, phone, aud, role) values
  ('00000000-0000-0000-0000-00000000000a', 'ama@example.com', '233209990001', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', 'kola@example.com', '234809990002', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000c', 'staff@example.com', null, 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000d', 'outsider@example.com', null, 'authenticated', 'authenticated');

select is((select count(*)::int from public.profiles where id::text like '00000000-0000-0000-0000-00000000000%'), 4,
  'profiles are created for new auth users');

create function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select lives_ok($$ select public.create_business('Ama Provisions', 'retail', 'GH', 'GHS', 'Africa/Accra') $$,
  'authenticated user can create a business');
select is((select role::text from public.memberships where user_id = '00000000-0000-0000-0000-00000000000a'), 'owner',
  'creator becomes owner');
select lives_ok($$ select public.add_member((select id from public.businesses where name = 'Ama Provisions'), 'STAFF@example.com', 'staff') $$,
  'owner can add a member by email');

select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select public.create_business('Kola Foods', 'food', 'NG', 'NGN');
select is((select count(*)::int from public.businesses), 1, 'Kola sees only their own business');
select is((select name from public.businesses), 'Kola Foods', 'and it is the right one');
select is((select count(*)::int from public.memberships), 1, 'Kola sees only their own memberships');
select throws_ok($$ select public.add_member((select id from public.businesses where name = 'Ama Provisions'), 'outsider@example.com', 'owner') $$,
  '42501', 'Only owners can add members', 'cannot add members to another business');

select pg_temp.login('00000000-0000-0000-0000-00000000000c');
select is((select count(*)::int from public.businesses), 1, 'staff sees the business they belong to');
select is((select count(*)::int from public.profiles), 2, 'staff sees own and co-member profiles only');
update public.businesses set name = 'Hijacked' where name = 'Ama Provisions';
select is((select name from public.businesses), 'Ama Provisions', 'staff cannot rename the business');

select pg_temp.login('00000000-0000-0000-0000-00000000000d');
select is((select count(*)::int from public.businesses), 0, 'outsider sees no businesses');

select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select throws_ok($$ delete from public.memberships where user_id = '00000000-0000-0000-0000-00000000000a' $$,
  'P0001', 'A business must keep at least one owner', 'last owner cannot leave');

reset role;
set local role anon;
select throws_ok($$ select * from public.businesses $$, '42501', null, 'anon has no table access');

select * from finish();
rollback;
