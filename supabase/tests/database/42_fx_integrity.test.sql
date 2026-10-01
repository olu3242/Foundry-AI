begin;
create extension if not exists pgtap with schema extensions;
select plan(13);
update public.platform_settings set value = 'false' where key = 'dual_approval';

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000a044', 'owner@b44.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000b044', 'admin@b44.test', 'authenticated', 'authenticated');
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-00000000b044');
create function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000a044');
select public.create_business('Cedi Shop', null, 'GH', 'GHS') as gh \gset
select public.create_business('Naira Shop', null, 'NG', 'NGN') as us \gset
select pg_temp.login('00000000-0000-0000-0000-00000000b044');
select is((public.fx_status() ->> 'usd_reportable')::boolean, false, 'seeded placeholder rates are never reportable');
select is((select x ->> 'placeholder' from jsonb_array_elements(public.fx_status() -> 'rates') x where x ->> 'currency' = 'GHS'), 'true', 'seeds are labelled placeholder');
select throws_ok($$ select public.record_fx_rates('openexchangerates', current_date, '{"GHS":0.06}') $$, '42501', null, 'only the server records rates');
reset role;

set local role service_role;
select throws_ok($$ select public.record_fx_rates('seed: x', current_date, '{"GHS":0.06}') $$, '22023', null, 'a placeholder source cannot be recorded as real');
select is(public.record_fx_rates('openexchangerates', current_date, '{"GHS":0.0625,"USD":1,"NGN":-1,"zzz":2}'), 2, 'valid rates recorded, invalid dropped');
reset role;
select is((select source || ':' || is_placeholder from public.fx_rates where currency = 'GHS'), 'openexchangerates:false', 'current rate carries its source');
select is((select count(*)::int from public.fx_rate_history where currency = 'GHS'), 2, 'history is append-only (placeholder kept, labelled)');

-- Revenue snapshot at occurrence, never recomputed.
insert into public.revenue_events (source, external_id, business_id, amount_minor, currency) values ('mobile_money', 'b44:1', :'gh', 5000, 'GHS');
select is((select usd_minor || ':' || fx_placeholder from public.revenue_events where external_id = 'b44:1'), '313:false', 'GHS 50.00 → USD 3.13 at the day''s sourced rate');
set local role service_role;
select public.record_fx_rates('openexchangerates', current_date + 1, '{"GHS":0.08}');
reset role;
select is((select usd_minor from public.revenue_events where external_id = 'b44:1'), 313::bigint, 'a newer rate never rewrites history');
select is((select amount_minor || ' ' || currency from public.revenue_events where external_id = 'b44:1'), '5000 GHS', 'native amount preserved');

update public.fx_rates set fetched_at = now() - interval '3 days';
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000b044');
select is((select x ->> 'stale' from jsonb_array_elements(public.fx_status() -> 'rates') x where x ->> 'currency' = 'GHS'), 'true', 'old rates are stale');

-- Market prices: charged in the business's own currency, no FX.
select public.set_plan_price('growth', 'GHS', 8000);
select pg_temp.login('00000000-0000-0000-0000-00000000a044');
select public.choose_plan(:'gh', 'growth');
select public.choose_plan(:'us', 'growth');
select is(public.entitlement_status(:'gh') -> 'plan' ->> 'currency', 'GHS', 'the owner sees the market price');
select pg_temp.login('00000000-0000-0000-0000-00000000b044');
select public.rate_billing();
select is((select string_agg(b.currency || ' ' || b.amount_minor, ', ' order by b.currency) from public.billable_events b
  where b.business_id in (:'gh', :'us') and b.kind = 'plan_period'), 'GHS 8000, USD 500', 'GHS business billed in cedis; a market without a price pays the base price');

select * from finish();
rollback;
