begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000c1', 'owner@shop.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c2', 'partner@shop.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c3', 'stranger@shop.test', 'authenticated', 'authenticated');

create function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-0000000000c1');
select public.create_business('Ada Foods', null, 'NG', 'NGN') as bid \gset
select public.add_member(:'bid', 'partner@shop.test', 'partner');

insert into public.captures (business_id, channel, raw_text, client_ref)
values (:'bid', 'text', 'Sold 2 bags of rice at 45000 each to Mama Bisi, cash', 'outbox-1')
returning id as cap \gset
select is((select count(*)::int from public.jobs where dedupe_key = 'capture:' || :'cap'), 1, 'capture enqueues an extraction job');
select is((select count(*)::int from public.events where type = 'capture.received'), 1, 'capture emits capture.received');
select throws_ok(format($$ insert into public.captures (business_id, channel, raw_text, client_ref) values (%L, 'text', 'dup', 'outbox-1') $$, :'bid'),
  '23505', null, 'client_ref makes offline sync idempotent');
select throws_ok($$ insert into public.record_drafts (business_id, capture_id, kind, fields, confidence) values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000000', 'sale', '{}', 1) $$,
  '42501', null, 'users cannot fabricate AI drafts');

reset role;
set local role service_role;
update public.captures set status = 'drafted' where id = :'cap';
insert into public.record_drafts (business_id, capture_id, kind, fields, confidence) values
  (:'bid', :'cap', 'sale', '{"customer_name":"Mama Bisi","payment_method":"cash","total_minor":9000000,
    "items":[{"description":"Rice 50kg","product_name":"Rice 50kg","quantity":2,"unit_price_minor":4500000}]}', 0.92)
returning id as sale_draft \gset
insert into public.record_drafts (business_id, capture_id, kind, fields, confidence)
values (:'bid', :'cap', 'customer', '{"name":"Nobody"}', 0.3) returning id as cust_draft \gset

set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-0000000000c2');
select throws_ok(format('select public.confirm_draft(%L)', :'sale_draft'), 'P0002', null, 'partners cannot confirm drafts');

select pg_temp.login('00000000-0000-0000-0000-0000000000c3');
select is((select count(*)::int from public.record_drafts), 0, 'strangers see no drafts');

select pg_temp.login('00000000-0000-0000-0000-0000000000c1');
select lives_ok(format('select public.confirm_draft(%L)', :'sale_draft'), 'owner confirms the sale draft');
select is((select total_minor from public.sales), 9000000::bigint, 'sale recorded with total');
select is((select amount_paid_minor from public.sales), 9000000::bigint, 'cash sale is fully paid');
select is((select name from public.customers), 'Mama Bisi', 'customer linked by name');
select is((select stock_qty from public.products where name = 'Rice 50kg'), -2::numeric(14,3), 'sale draws stock down');
select is((select source_draft_id from public.sales), :'sale_draft'::uuid, 'sale keeps its source draft');
select throws_ok(format('select public.confirm_draft(%L)', :'sale_draft'), 'P0001', null, 'a draft cannot be confirmed twice');
select is((select status::text from public.captures where id = :'cap'), 'drafted', 'capture stays open while drafts are pending');
select lives_ok(format('select public.reject_draft(%L)', :'cust_draft'), 'owner rejects the other draft');
select is((select status::text from public.captures where id = :'cap'), 'resolved', 'capture resolves once every draft is handled');

select * from finish();
rollback;
