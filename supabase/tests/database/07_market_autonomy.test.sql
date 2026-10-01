begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000a7', 'owner@mk.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b7', 'staff@mk.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c7', 'buyer@mk.test', 'authenticated', 'authenticated');
create function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-0000000000a7');
select public.create_business('Market Co', 'Wholesale', 'NG', 'NGN') as bid \gset
select public.add_member(:'bid', 'staff@mk.test', 'staff');
select lives_ok(format($$ insert into public.autonomy_policies (business_id, action_type, level) values (%L, 'stock.alert', 0) $$, :'bid'), 'owner sets autonomy');

select pg_temp.login('00000000-0000-0000-0000-0000000000b7');
select throws_ok(format($$ insert into public.autonomy_policies (business_id, action_type, level) values (%L, 'growth.recommend', 3) $$, :'bid'),
  '42501', null, 'staff cannot change autonomy');
select throws_ok(format($$ insert into public.agent_actions (business_id, action_type, autonomy_level, title) values (%L, 'x', 5, 'fake') $$, :'bid'),
  '42501', null, 'users cannot fabricate agent actions');

reset role; set local role service_role;
insert into public.agent_actions (business_id, action_type, autonomy_level, title, dedupe_key)
values (:'bid', 'customer.reminder', 2, 'Remind Bisi', 'debtor:1') returning id as act \gset
select throws_ok(format($$ insert into public.agent_actions (business_id, action_type, autonomy_level, title, dedupe_key) values (%L, 'customer.reminder', 2, 'Again', 'debtor:1') $$, :'bid'),
  '23505', null, 'the same pending suggestion is never duplicated');

set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-0000000000b7');
select throws_ok(format($$ update public.agent_actions set title = 'edited' where id = %L $$, :'act'), '42501', null, 'suggestion text is immutable');
select lives_ok(format($$ select public.decide_action(%L, 'executed') $$, :'act'), 'staff marks a reminder as sent');
select is((select count(*)::int from public.events where type = 'action.executed'), 1, 'decisions are logged');

select pg_temp.login('00000000-0000-0000-0000-0000000000c7');
insert into public.opportunities (title, description, category, contact) values ('Need 20 bags of cement', 'Weekly delivery to site', 'buyer_request', 'buyer@mk.test') returning id as opp \gset
select throws_ok($$ insert into public.opportunities (title, description, category, is_sample) values ('Fake sample', 'desc here', 'other', true) $$,
  '42501', null, 'users cannot post sample opportunities');
select ok((select count(*) from public.opportunities where is_sample) >= 1, 'seeded samples are visible to everyone');

reset role; set local role service_role;
insert into public.opportunity_matches (opportunity_id, business_id, score, eligible) values (:'opp', :'bid', 70, true);
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-0000000000a7');
select throws_ok(format($$ update public.opportunity_matches set score = 100 where opportunity_id = %L $$, :'opp'), '42501', null, 'businesses cannot inflate match scores');
update public.opportunity_matches set status = 'interested' where opportunity_id = :'opp';

select pg_temp.login('00000000-0000-0000-0000-0000000000c7');
select is((select count(*)::int from public.opportunity_matches where opportunity_id = :'opp'), 1, 'posters see who is interested');

select * from finish();
rollback;
