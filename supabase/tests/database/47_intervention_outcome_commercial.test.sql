begin;
create extension if not exists pgtap with schema extensions;
update public.platform_settings set value = 'false' where key = 'dual_approval';
select plan(17);

insert into auth.users (id, email, phone, aud, role) values
  ('00000000-0000-0000-0000-00000000a056', 'owner@b56.test', '233240000058', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000b056', 'admin@b56.test', null, 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000c056', 'partner@b56.test', null, 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000d056', 'other@b56.test', null, 'authenticated', 'authenticated');
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-00000000b056');
create function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000a056');
select public.create_business('Contract Stall', null, 'GH', 'GHS') as bid \gset
reset role;
insert into public.memberships (business_id, user_id, role) values (:'bid', '00000000-0000-0000-0000-00000000c056', 'partner');
insert into public.interventions (business_id, title, target_metric, expected_direction, baseline_value, due_at, created_by, created_by_role)
values (:'bid', 'Push weekend sales', 'sales_30', 'up', 100000, now() + interval '14 days', '00000000-0000-0000-0000-00000000a056', 'owner') returning id as iid \gset
insert into public.interventions (business_id, title, target_metric, expected_direction, baseline_value, due_at, created_by, created_by_role, status, completed_at)
values (:'bid', 'Clean the till', 'sales_30', 'up', 100000, now(), '00000000-0000-0000-0000-00000000a056', 'owner', 'completed', now()) returning id as i2 \gset

-- B56 outcome contract
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000c056');
select throws_ok(format($$ select public.set_outcome_contract(%L, 150000) $$, :'iid'), '42501', null, 'only the owner approves the outcome contract');
select pg_temp.login('00000000-0000-0000-0000-00000000a056');
select throws_ok(format($$ select public.set_outcome_contract(%L, 90000) $$, :'iid'), '22023', null, 'a target must improve on the baseline');
select lives_ok(format($$ select public.set_outcome_contract(%L, 150000, 2000, 60) $$, :'iid'), 'owner approves target, cost and effort');
reset role;
select is((select cost_currency || ':' || (contract_approved_at is not null) from public.interventions where id = :'iid'), 'GHS:true', 'contract approved, cost in native currency');
select is((private.intervention_execution(array[:'bid'::uuid], now() - interval '1 day') ->> 'approved')::int, 1, 'execution report counts approved contracts');
select is(private.intervention_execution(array[:'bid'::uuid], now() - interval '1 day') -> 'cost_native', '{"GHS": 2000}'::jsonb, 'cost reported natively');

-- B57 ladder: observed → measured → verified → attributed
select is((private.outcome_ladder(array[:'bid'::uuid], now() - interval '1 day') ->> 'observed')::int, 1, 'a finished plan without a measured result is only observed');
insert into public.outcomes (intervention_id, business_id, metric, baseline_value, observed_value, delta, improved, window_start, window_end, status)
values (:'iid', :'bid', 'sales_30', 100000, 130000, 30000, true, now() - interval '14 days', now(), 'observed') returning id as oid \gset
select is((private.outcome_ladder(array[:'bid'::uuid], now() - interval '1 day') ->> 'verified')::int, 0, 'measured is not verified');
select is(private.outcome_ladder(array[:'bid'::uuid], now() - interval '1 day') -> 'vei_native', '{}'::jsonb, 'no VEI from unverified outcomes');
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000c056');
select throws_ok(format($$ select public.assess_attribution(%L, 'likely', 'weekend promo only change') $$, :'oid'), 'P0001', null, 'attribution only after verification');
reset role;
update public.outcomes set status = 'verified', verified_by = '00000000-0000-0000-0000-00000000c056', verifier_role = 'partner', verified_at = now() where id = :'oid';
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000a056');
select throws_ok(format($$ select public.assess_attribution(%L, 'likely', 'I am sure it was the plan') $$, :'oid'), '42501', null, 'owners cannot attribute their own result');
select pg_temp.login('00000000-0000-0000-0000-00000000c056');
select public.assess_attribution(:'oid', 'contributed', 'Promo ran; no other change reported; seasonality not ruled out');
reset role;
select is(private.outcome_ladder(array[:'bid'::uuid], now() - interval '1 day') -> 'vei_native', '{"GHS": {"incremental_revenue_minor": 30000, "cost_savings_minor": 0, "losses_avoided_minor": 0}}'::jsonb,
  'VEI from the verified outcome only, native currency');
select is((private.outcome_ladder(array[:'bid'::uuid], now() - interval '1 day') ->> 'attributed')::int, 1, 'attributed counted separately');

-- B58 offers → acceptance/rejection → charge → payment → revenue
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000d056');
select throws_ok(format($$ select public.make_offer(%L, null, 'plan', 'business', 'growth', 500) $$, :'bid'), '42501', null, 'only operators or admins make offers');
select pg_temp.login('00000000-0000-0000-0000-00000000b056');
select public.make_offer(:'bid', null, 'plan', 'business', 'growth', 500) as o1 \gset
select public.make_offer(:'bid', null, 'plan', 'business', 'growth', 500) as o2 \gset
select pg_temp.login('00000000-0000-0000-0000-00000000a056');
select throws_ok(format($$ select public.respond_to_offer(%L, false) $$, :'o1'), '22023', null, 'a rejection needs a reason');
select public.respond_to_offer(:'o1', false, 'no_cash_now');
select public.respond_to_offer(:'o2', true);
reset role;
select is((select source || ':' || (select key from public.billing_plans where id = plan_id) from public.entitlements where business_id = :'bid' and status = 'active' and source = 'purchase'), 'purchase:growth',
  'acceptance starts the purchase');
select is(private.commercial_funnel(array[:'bid'::uuid], now() - interval '1 day') - 'by_payer' - 'churn_reasons' - 'online_payments',
  '{"value_experienced":1,"offered":1,"accepted":1,"rejected":1,"rejection_reasons":{"no_cash_now":1},"charged":0,"paid":0,"revenue_native":{},"unpaid_open_charges":0}'::jsonb,
  'acceptance is not revenue: nothing charged, paid or collected yet');

select * from finish();
rollback;
