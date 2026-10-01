begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000d1', 'owner@ws.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000d2', 'partner@ws.test', 'authenticated', 'authenticated');

create function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-0000000000d1');
select public.create_business('Kofi Hardware', null, 'GH', 'GHS') as bid \gset
select public.add_member(:'bid', 'partner@ws.test', 'partner');

select public.record_entry(:'bid', 'stock_movement', '{"product_name":"Cement","quantity_delta":10,"reason":"purchase","unit_cost_minor":8000}');
select public.record_entry(:'bid', 'sale', '{"payment_method":"credit","total_minor":30000,"amount_paid_minor":10000,"customer_name":"Yaw",
  "items":[{"description":"Cement","product_name":"Cement","quantity":3,"unit_price_minor":10000}]}') as sale_id \gset
select public.record_entry(:'bid', 'expense', '{"category":"Transport","amount_minor":5000,"payment_method":"cash"}');

select is((select stock_qty from public.products where name = 'Cement'), 7::numeric(14,3), 'purchase then sale leaves 7 in stock');
select results_eq(
  format($$ select sales_count, sales_minor, collected_minor, receivable_minor, expenses_minor, net_minor from public.business_summary(%L, now() - interval '1 day', now() + interval '1 day') $$, :'bid'),
  $$ values (1, 30000::bigint, 10000::bigint, 20000::bigint, 5000::bigint, 25000::bigint) $$,
  'summary totals sales, collections, receivables, expenses and net');
select is((select count(*)::int from public.events where business_id = :'bid' and payload ->> 'via' = 'manual'), 1, 'manual sale is marked as manual');
select is((select provenance::text from public.sales where id = :'sale_id'), 'self_reported', 'hand entries are self-reported');

select pg_temp.login('00000000-0000-0000-0000-0000000000d2');
select throws_ok(format($$ select public.record_entry(%L, 'expense', '{"category":"x","amount_minor":1,"payment_method":"cash"}') $$, :'bid'),
  '42501', null, 'partners cannot record');
select throws_ok(format($$ select public.void_record('sale', %L) $$, :'sale_id'), 'P0002', null, 'partners cannot void');

select pg_temp.login('00000000-0000-0000-0000-0000000000d1');
select lives_ok(format($$ select public.void_record('sale', %L, 'entered twice') $$, :'sale_id'), 'owner voids the sale');
select is((select stock_qty from public.products where name = 'Cement'), 10::numeric(14,3), 'voiding a sale returns its stock');
select is((select sales_count from public.business_summary(:'bid', now() - interval '1 day', now() + interval '1 day')), 0, 'voided sales drop out of the summary');
select throws_ok(format($$ select public.void_record('sale', %L) $$, :'sale_id'), 'P0002', null, 'cannot void twice');

select * from finish();
rollback;
