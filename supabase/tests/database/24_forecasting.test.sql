begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000a026', 'owner@b26.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000d026', 'other@b26.test', 'authenticated', 'authenticated');
create function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000a026');
select public.create_business('Sparse Shop') as sparse \gset
select public.create_business('Steady Shop') as steady \gset
select public.record_entry(:'sparse', 'sale', jsonb_build_object('total_minor', 5000, 'occurred_at', date_trunc('week', now()) - interval '6 days'));

-- Steady: 11 weeks of sales ~10,000 with a quiet 1,000/week expense line and an item sold weekly.
select public.record_entry(:'steady', 'sale', jsonb_build_object('total_minor', 10000 + (w % 3) * 500, 'occurred_at', date_trunc('week', now()) - (w * 7 - 2 || ' days')::interval,
  'items', jsonb_build_array(jsonb_build_object('product_name', 'Bread', 'quantity', 5, 'unit_price_minor', (10000 + (w % 3) * 500) / 5))))
from generate_series(1, 11) w;
select public.record_entry(:'steady', 'expense', jsonb_build_object('amount_minor', 1000, 'category', 'Transport', 'occurred_at', date_trunc('week', now()) - (w * 7 - 3 || ' days')::interval))
from generate_series(1, 11) w;
select public.record_entry(:'steady', 'stock_movement', '{"product_name":"Bread","quantity_delta":60,"reason":"purchase"}');

select pg_temp.login('00000000-0000-0000-0000-00000000d026');
select throws_ok(format($$ select public.compute_forecasts(%L) $$, :'steady'), '42501', null, 'strangers cannot compute forecasts');
select pg_temp.login('00000000-0000-0000-0000-00000000a026');
select public.compute_forecasts(:'sparse');
select public.compute_forecasts(:'steady');

select is((select confidence from public.latest_forecasts(:'sparse') where kind = 'sales_outlook'), 'insufficient', 'sparse data → insufficient');
select is((select result from public.latest_forecasts(:'sparse') where kind = 'sales_outlook'), null, 'no number is fabricated');
select ok((select request like 'Record sales for 5 more%' from public.latest_forecasts(:'sparse') where kind = 'sales_outlook'), 'it asks for more data instead');

select ok((select confidence in ('high', 'medium') from public.latest_forecasts(:'steady') where kind = 'sales_outlook'), 'regular data → usable confidence');
select ok((select (result ->> 'low')::numeric <= (result ->> 'point')::numeric and (result ->> 'point')::numeric <= (result ->> 'high')::numeric
           from public.latest_forecasts(:'steady') where kind = 'sales_outlook'), 'point sits inside its interval');
select ok((select (result ->> 'point')::numeric between 38000 and 46000 from public.latest_forecasts(:'steady') where kind = 'sales_outlook'), 'four weeks ≈ 4 × weekly sales');
select ok((select jsonb_array_length(assumptions) >= 3 and basis like 'Sales in 11 of the last 12 weeks%' from public.latest_forecasts(:'steady') where kind = 'sales_outlook'),
  'basis and assumptions are explicit');
select is((select (result ->> 'warning')::boolean from public.latest_forecasts(:'steady') where kind = 'cash_pressure'), false, 'collections cover expenses: no cash warning');
select is((select (result ->> 'runs_out_within_horizon')::boolean from public.latest_forecasts(:'steady') where kind = 'inventory_demand'), true,
  'bread (5/week, ~5 left) runs out within two weeks');
select is((select confidence from public.latest_forecasts(:'steady') where kind = 'collections'), null, 'no credit history → no collections forecast');

-- Reproducible from stored inputs; tampering is detected.
select id as fid from public.latest_forecasts(:'steady') where kind = 'sales_outlook' \gset
select is((public.reproduce_forecast(:'fid') ->> 'matches')::boolean, true, 'forecasts are reproducible');
reset role;
update public.forecasts set inputs = jsonb_set(inputs, '{weekly,0}', '99999') where id = :'fid';
set local role authenticated;
select is((public.reproduce_forecast(:'fid') ->> 'matches')::boolean, false, 'changed inputs no longer reproduce');
select is((select count(*)::int from public.forecasts where business_id = :'steady'
    and ((kind = 'intervention_scenario' and method_version = 'fc-v2-consent')
      or (kind <> 'intervention_scenario' and method_version = 'fc-v1'))),
  (select count(*)::int from public.forecasts where business_id = :'steady'),
  'every forecast records its expected method version');

select * from finish();
rollback;
