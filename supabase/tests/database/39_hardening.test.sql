begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

update public.platform_settings set value = 'true' where key = 'dual_approval';
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000a041', 'admin1@b41.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000b041', 'admin2@b41.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000c041', 'user@b41.test', 'authenticated', 'authenticated');
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-00000000a041'), ('00000000-0000-0000-0000-00000000b041');
create function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000a041');
select public.save_policy('solution.start', 'market', 'KE', '{"default":"allow"}', 'v1') as pol \gset
select throws_like(format($$ select public.activate_policy(%L) $$, :'pol'), 'This change needs a second approver%', 'policies cannot be activated by one admin');
select throws_like($$ select public.upsert_pack('tailoring', 'Tailors', '{"entities":{},"metrics":{},"pulse":[]}') $$, 'This change needs a second approver%', 'packs need approval');
select throws_like($$ select public.upsert_market('{"country_code":"UG","name":"Uganda","currency":"UGX","default_timezone":"Africa/Kampala","phone_prefix":"256"}') $$,
  'This change needs a second approver%', 'markets need approval');
select throws_like($$ select public.update_dataset('operating_patterns', array['research'], 5) $$, 'This change needs a second approver%', 'dataset publication needs approval');
select throws_like($$ select public.set_platform_setting('dual_approval', 'false') $$, 'This change needs a second approver%', 'turning approval off needs approval too');

select public.request_change('policy_activation', :'pol', '{}', 'Open Kenya for proven plans') as cr \gset
select throws_ok(format($$ select public.decide_change(%L, true) $$, :'cr'), '42501', null, 'the requester cannot approve their own change');
select pg_temp.login('00000000-0000-0000-0000-00000000c041');
select throws_ok(format($$ select public.decide_change(%L, true) $$, :'cr'), '42501', null, 'non-admins cannot decide');
select pg_temp.login('00000000-0000-0000-0000-00000000b041');
select is(public.decide_change(:'cr', true, 'Checked with legal'), 'applied', 'a second admin approves and the change applies');
reset role;
select is((select status from public.policies where id = :'pol'), 'active', 'the policy is active');
select ok((select decided_by <> requested_by from public.change_requests where id = :'cr'), 'four eyes recorded');
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000a041');
select public.request_change('dataset_update', 'operating_patterns', '{"allowed_uses":["research"],"min_group_size":3}', 'Shrink groups') as bad \gset
select pg_temp.login('00000000-0000-0000-0000-00000000b041');
select is(public.decide_change(:'bad', true), 'failed', 'approved changes still obey invariants (min group 5)');
reset role;
select ok((select error like 'Groups smaller than 5%' from public.change_requests where id = :'bad'), 'and the failure reason is kept');

select * from finish();
rollback;
