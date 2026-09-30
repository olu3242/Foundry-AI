begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000a021', 'owner@b21.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000b021', 'admin@b21.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000c021', 'sponsor@b21.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000d021', 'other@b21.test', 'authenticated', 'authenticated');
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-00000000b021');
insert into public.billing_plans (key, name, payer_kind, entitlements) values ('tiny', 'Tiny', 'business', '{"plan.start":1}');
create function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000a021');
select public.create_business('Paying Shop', null, 'GH', 'GHS') as bid \gset
select is(public.entitlement_status(:'bid') -> 'plan' ->> 'key', 'free', 'every new business starts on Free');

-- Hard limits deny without recording usage.
reset role;
update public.entitlements set plan_id = (select id from public.billing_plans where key = 'tiny') where business_id = :'bid';
set local role authenticated;
select lives_ok(format($$ select public.start_intervention(%L, 'Plan A', 'sales_30', 7) $$, :'bid'), 'within the limit a plan starts');
select throws_ok(format($$ select public.start_intervention(%L, 'Plan B', 'sales_30', 7) $$, :'bid'), 'P0001', null, 'over a hard limit the action is refused');
select is((select count(*)::int from public.usage_events where business_id = :'bid' and feature = 'plan.start'), 1, 'refused actions record no usage');
reset role;
update public.entitlements set plan_id = (select id from public.billing_plans where key = 'free') where business_id = :'bid';
select ok(public.consume_entitlement(:'bid', 'capture.ai', 'capture:x') and public.consume_entitlement(:'bid', 'capture.ai', 'capture:x'), 'metering is allowed');
select is((select count(*)::int from public.usage_events where correlation_id = 'capture:x'), 1, 'metering is idempotent per correlation id');

-- Business-paid plan.
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000d021');
select throws_ok(format($$ select public.choose_plan(%L, 'growth') $$, :'bid'), '42501', null, 'only the owner changes the plan');
select pg_temp.login('00000000-0000-0000-0000-00000000a021');
select throws_ok(format($$ select public.choose_plan(%L, 'sponsored_growth') $$, :'bid'), 'P0001', null, 'sponsor plans cannot be bought directly');
select public.choose_plan(:'bid', 'growth');
select is(public.entitlement_status(:'bid') -> 'plan' ->> 'key', 'growth', 'owner upgrades to Growth');

-- Sponsor-paid access follows consented enrollment.
select pg_temp.login('00000000-0000-0000-0000-00000000c021');
select public.create_program('Sponsor Program', 'Example Bank') as pid \gset
select join_code as code from public.programs where id = :'pid' \gset
select public.sponsor_plan(:'pid', 'sponsored_growth');
select pg_temp.login('00000000-0000-0000-0000-00000000a021');
select public.join_program(:'bid', :'code', true);
select is(public.entitlement_status(:'bid') ->> 'paid_by', 'Sponsor Program', 'a sponsoring program pays once the business joins');

-- Rating.
select throws_ok($$ select public.rate_billing() $$, '42501', null, 'only platform admins rate billing');
reset role;
insert into public.usage_events (business_id, entitlement_id, feature, quantity, overage, correlation_id)
select :'bid', id, 'capture.ai', 3, true, 'over:1' from public.entitlements where business_id = :'bid' and source = 'purchase' and status = 'active';
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000b021');
select public.rate_billing();
select is((select count(*)::int from public.billable_events where business_id = :'bid' and kind = 'plan_period'), 2, 'each paid entitlement becomes a plan charge');
select is((select payer_kind from public.billable_events where business_id = :'bid' and kind = 'plan_period' and payer_program_id = :'pid'), 'program', 'sponsored charges bill the program');
select is((select amount_minor::int from public.billable_events where business_id = :'bid' and kind = 'overage'), 3, 'overage = units × unit price');
select is(public.rate_billing(), 1, 'rating is idempotent (only the open overage refreshes)');

-- Settlement → revenue → trace.
select id as beid from public.billable_events where business_id = :'bid' and kind = 'plan_period' and payer_kind = 'business' \gset
select throws_ok(format($$ select public.settle_billable_event(%L, 'mobile_money', '') $$, :'beid'), '22023', null, 'settlement needs a payment reference');
select public.settle_billable_event(:'beid', 'mobile_money', 'MOMO-123') as rid \gset
select is(public.settle_billable_event(:'beid', 'mobile_money', 'MOMO-123'), :'rid'::uuid, 'settlement is idempotent');
select is(public.commercial_trace(:'rid') -> 'product' ->> 'key', 'growth', 'revenue traces to the product');
select is(public.commercial_trace(:'rid') -> 'usage' ->> 'capture.ai', '3', 'revenue traces to entitlement usage');

select pg_temp.login('00000000-0000-0000-0000-00000000d021');
select is((select count(*)::int from public.billable_events where business_id = :'bid'), 0, 'strangers see no charges');

select * from finish();
rollback;
