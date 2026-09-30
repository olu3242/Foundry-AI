begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, email, phone, aud, role) values
  ('00000000-0000-0000-0000-00000000a013', 'admin@dist.test', null, 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000b013', 'partner@dist.test', null, 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000c013', 'owner@dist.test', '233501110001', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000d013', 'stranger@dist.test', null, 'authenticated', 'authenticated');
create function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000a013');
select public.create_program('Dist Program') as pid \gset
select join_code as code from public.programs where id = :'pid' \gset
select public.add_program_member(:'pid', 'partner@dist.test', 'partner');
select is(public.bulk_invite(:'pid', array['a@x.test', 'A@X.test', 'b@x.test']), 2, 'bulk invites dedupe contacts');

select pg_temp.login('00000000-0000-0000-0000-00000000b013');
select is(public.bulk_invite(:'pid', array['+233 50 111 0001']), 1, 'partners can invite');
select pg_temp.login('00000000-0000-0000-0000-00000000d013');
select throws_ok(format($$ select public.bulk_invite(%L, array['c@x.test']) $$, :'pid'), '42501', null, 'strangers cannot invite');

select pg_temp.login('00000000-0000-0000-0000-00000000c013');
select public.create_business('Invited Shop') as bid \gset
select is((select channel from public.acquisition_attributions where business_id = :'bid'), 'organic', 'new businesses start organic');
select public.join_program(:'bid', :'code', true);
select is((select channel from public.acquisition_attributions where business_id = :'bid'), 'partner_invite', 'joining via a partner invite credits the partner');
select is((select count(*)::int from public.program_access_for_business(:'bid')), 1, 'owners see which programs see their data');

select pg_temp.login('00000000-0000-0000-0000-00000000a013');
select is((public.program_report(:'pid') ->> 'invited')::int, 3, 'report counts invitations');
select is((public.program_report(:'pid') ->> 'conversion')::numeric, 0.333, 'report computes conversion');
select is(public.program_report(:'pid') -> 'by_channel' ->> 'partner_invite', '<5', 'small channel groups are suppressed');
select pg_temp.login('00000000-0000-0000-0000-00000000b013');
select throws_ok(format($$ select public.program_report(%L) $$, :'pid'), '42501', null, 'reports are for program admins');

select * from finish();
rollback;
