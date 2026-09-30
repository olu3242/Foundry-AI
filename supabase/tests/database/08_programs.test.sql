begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000a8', 'owner@prog.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b8', 'admin@prog.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c8', 'partner@prog.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000d8', 'other-partner@prog.test', 'authenticated', 'authenticated');
create function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-0000000000a8');
select public.create_business('Enrolled Shop', null, 'GH', 'GHS') as bid \gset
select public.record_entry(:'bid', 'sale', '{"payment_method":"cash","total_minor":1000}');

select pg_temp.login('00000000-0000-0000-0000-0000000000b8');
select public.create_program('Accra Retail Accelerator', 'Example Bank') as pid \gset
select join_code as code from public.programs where id = :'pid' \gset
select public.add_program_member(:'pid', 'partner@prog.test', 'partner');
select public.add_program_member(:'pid', 'other-partner@prog.test', 'partner');
select is((select count(*)::int from public.sales), 0, 'program admin sees nothing before a business joins');

select pg_temp.login('00000000-0000-0000-0000-0000000000a8');
select throws_ok(format($$ select public.join_program(%L, %L, false) $$, :'bid', :'code'), 'P0001', null, 'joining requires explicit consent');
select lives_ok(format($$ select public.join_program(%L, %L, true) $$, :'bid', lower(:'code')), 'owner joins with the code and consent');

select pg_temp.login('00000000-0000-0000-0000-0000000000b8');
select is((select count(*)::int from public.sales where business_id = :'bid'), 1, 'program admin reads consented records');
select is(public.my_business_role(:'bid')::text, 'program_admin', 'program admin role is derived');
select throws_ok(format($$ select public.record_entry(%L, 'expense', '{"category":"x","amount_minor":1,"payment_method":"cash"}') $$, :'bid'),
  '42501', null, 'program admins cannot write the books');
select public.assign_partner(:'pid', '00000000-0000-0000-0000-0000000000c8', :'bid');

select pg_temp.login('00000000-0000-0000-0000-0000000000c8');
select is((select count(*)::int from public.sales where business_id = :'bid'), 1, 'assigned partner reads records');
select lives_ok(format($$ select public.add_verification(%L, 'business', 'third_party_verified', 'site_visit') $$, :'bid'), 'assigned partner verifies after a visit');

select pg_temp.login('00000000-0000-0000-0000-0000000000d8');
select is((select count(*)::int from public.sales where business_id = :'bid'), 0, 'unassigned partners see nothing');

select pg_temp.login('00000000-0000-0000-0000-0000000000a8');
select public.leave_program(:'bid', :'pid');
select pg_temp.login('00000000-0000-0000-0000-0000000000b8');
select is((select count(*)::int from public.sales where business_id = :'bid'), 0, 'leaving withdraws access immediately');
select pg_temp.login('00000000-0000-0000-0000-0000000000c8');
select is((select count(*)::int from public.partner_assignments), 0, 'partner assignments end with consent');

select throws_ok(format($$ update public.programs set subscription_status = 'active' where id = %L $$, :'pid'), '42501', null, 'billing status is not user-writable');
reset role;
set local role anon;
select throws_ok($$ select * from public.programs $$, '42501', null, 'anon cannot list programs');

select * from finish();
rollback;
