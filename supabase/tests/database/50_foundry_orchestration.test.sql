begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000f061', 'flow-owner@test.dev', 'authenticated', 'authenticated');
insert into public.profiles (id, display_name) values
  ('00000000-0000-0000-0000-00000000f061', 'Flow Owner');
insert into public.businesses (id, name, country_code, currency, created_by)
values ('00000000-0000-0000-0000-00000000f062', 'Flow Test', 'GH', 'GHS', '00000000-0000-0000-0000-00000000f061');
insert into public.memberships (business_id, user_id, role)
values ('00000000-0000-0000-0000-00000000f062', '00000000-0000-0000-0000-00000000f061', 'owner');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000f061', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select lives_ok($$
  select public.create_foundry_flow(
    '00000000-0000-0000-0000-00000000f063',
    '00000000-0000-0000-0000-00000000f062',
    'customer.reminder',
    '00000000-0000-0000-0000-00000000f064',
    'awaiting_approval', 'hil', true,
    '{"kind":"messaging","action":"send"}', true, 'decision.engine'
  )
$$, 'owner can create a governed flow through the definer boundary');

select is((select stage from public.foundry_flows where id='00000000-0000-0000-0000-00000000f063'), 'awaiting_approval',
  'flow persists awaiting approval');
select is((select count(*)::int from public.foundry_flow_transitions where flow_id='00000000-0000-0000-0000-00000000f063'), 1,
  'creation writes the first transition');

select lives_ok($$ select public.approve_foundry_flow('00000000-0000-0000-0000-00000000f063', 'owner approved') $$,
  'owner can approve a HIL flow');
select is((select stage from public.foundry_flows where id='00000000-0000-0000-0000-00000000f063'), 'ready',
  'approval moves the flow to ready');
select is((select approval_required from public.foundry_flows where id='00000000-0000-0000-0000-00000000f063'), false,
  'approval clears the approval requirement');
select is((select count(*)::int from public.foundry_flow_transitions where flow_id='00000000-0000-0000-0000-00000000f063'), 2,
  'approval appends a transition');

select throws_ok(
  $$ select public.approve_foundry_flow('00000000-0000-0000-0000-00000000f063', 'again') $$,
  '22023', 'Flow is not awaiting approval',
  'an already-approved flow cannot be approved again'
);

select * from finish();
rollback;
