begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

insert into auth.users (id, email, phone, aud, role) values
  ('00000000-0000-0000-0000-00000000a043', 'owner@b43.test', '233240000043', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000b043', 'admin@b43.test', null, 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000d043', 'other@b43.test', null, 'authenticated', 'authenticated');
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-00000000b043');
create function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.svc() returns void language sql as $$
  select set_config('request.jwt.claims', '{"role":"service_role"}', true);
$$;

set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000a043');
select public.create_business('Pay Shop', null, 'GH', 'GHS') as bid \gset
reset role;
insert into public.billable_events (dedupe_key, kind, business_id, payer_kind, description, amount_minor, currency)
values ('b43:1', 'plan_period', :'bid', 'business', 'Growth plan · Oct', 5000, 'GHS'),
       ('b43:2', 'plan_period', :'bid', 'business', 'Growth plan · Nov', 5000, 'GHS'),
       ('b43:3', 'plan_period', :'bid', 'business', 'Growth plan · Dec', 5000, 'GHS');
select id as c1 from public.billable_events where dedupe_key = 'b43:1' \gset
select id as c2 from public.billable_events where dedupe_key = 'b43:2' \gset
select id as c3 from public.billable_events where dedupe_key = 'b43:3' \gset

-- Request
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000d043');
select throws_ok(format($$ select public.create_payment_request(%L) $$, :'c1'), 'P0002', null, 'outsiders cannot pay (or see) a business''s charge');
select pg_temp.login('00000000-0000-0000-0000-00000000a043');
select public.create_payment_request(:'c1') ->> 'id' as p1 \gset
select is((select status || ':' || amount_minor || ':' || currency from public.payment_requests where id = :'p1'), 'created:5000:GHS', 'request mirrors the charge (native amount and currency)');
select is(public.create_payment_request(:'c1') ->> 'id', :'p1', 'an open request is reused, never two checkouts for one charge');
select throws_ok($$ select public.apply_payment_result('x', 'success', '1', 1, 'GHS', 'card', now(), 'e', 'charge', '{}') $$, '42501', null,
  'only the server applies provider results');
select public.create_payment_request(:'c2') ->> 'id' as p2 \gset
select public.create_payment_request(:'c3') ->> 'reference' as ref3 \gset
reset role;

set local role service_role;
select pg_temp.svc();
select public.record_payment_initialized(:'p1', 'acc_1', 'https://checkout.paystack.com/acc_1', '');
select is((select status from public.payment_requests where id = :'p1'), 'pending', 'checkout initialised → pending');
select reference as ref1 from public.payment_requests where id = :'p1' \gset
select reference as ref2 from public.payment_requests where id = :'p2' \gset

-- Result
select is(public.apply_payment_result(:'ref2', 'success', '9002', 4000, 'GHS', 'mobile_money', now(), 'paystack:9002:success', 'charge', '{}'), 'mismatch',
  'a different amount is held, never settled');
select is((select status from public.billable_events where id = :'c2'), 'open', 'mismatched payment leaves the charge open');
select is(public.apply_payment_result(:'ref1', 'success', '9001', 5000, 'GHS', 'mobile_money', now(), 'paystack:9001:success', 'charge', '{}'), 'succeeded',
  'matching mobile-money payment settles');
select is((select b.status || ':' || r.external_id || ':' || r.amount_minor from public.payment_requests p join public.billable_events b on b.id = p.billable_event_id
  join public.revenue_events r on r.id = p.revenue_event_id where p.id = :'p1'), 'paid:mobile_money:paystack:9001:5000', 'revenue links to the provider transaction');
select is(public.apply_payment_result(:'ref1', 'success', '9001', 5000, 'GHS', 'mobile_money', now(), 'paystack:9001:success', 'charge', '{}'), 'duplicate_event',
  'webhook replays are ignored');
select is(public.apply_payment_result(:'ref1', 'success', '9001', 5000, 'GHS', 'mobile_money', now(), 'paystack:9001:verify-later', 'verify', '{}'), 'succeeded',
  'a later verification is history only');
select is((select count(*)::int from public.revenue_events where billable_event_id = :'c1'), 1, 'one charge, one revenue row');

-- Paid by hand first, then online → duplicate, not double revenue.
select public.settle_billable_event(:'c3', 'mobile_money', 'MOMO-HAND-1');
select is(public.apply_payment_result(:'ref3', 'success', '9003', 5000, 'GHS', 'card', now(), 'paystack:9003:success', 'charge', '{}'), 'duplicate',
  'second payment for a paid charge is held as duplicate');
select is(public.apply_payment_result('fdy_nope', 'success', '9999', 1, 'GHS', 'card', now(), 'paystack:9999:success', 'charge', '{}'), 'unmatched',
  'unknown references are recorded, not dropped');
reset role;

-- Refunds (platform admin)
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000b043');
select throws_ok(format($$ select public.request_payment_refund(%L, 6000, 'customer asked') $$, :'p1'), '22023', null, 'cannot refund more than was paid');
select public.request_payment_refund(:'p1', 2000, 'Partial goodwill refund') as f1 \gset
reset role;
set local role service_role;
select pg_temp.svc();
select public.record_refund_submission(:'f1', 'rf_1', '');
select is(public.apply_refund_result('9001', 'rf_1', 'processed', 2000, 'paystack:refund.processed:rf_1', '{}'), 'processed', 'provider-confirmed refund applies');
select is((select p.status || ':' || p.refunded_minor || ':' || r.amount_minor || ':' || r.external_id from public.payment_requests p
  join public.payment_refunds f on f.payment_request_id = p.id join public.revenue_events r on r.id = f.revenue_event_id where p.id = :'p1'),
  'partially_refunded:2000:-2000:refund:paystack:rf_1', 'refund reverses revenue with a traceable row; the original stays');
select is(public.apply_refund_result('9001', 'rf_1', 'processed', 2000, 'paystack:refund.processed:rf_1', '{}'), 'duplicate_event', 'refund replays are ignored');
reset role;

set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000b043');
select is((public.payment_reconciliation(30) -> 'checks')::jsonb - 'unmatched_events' - 'stuck_pending_24h',
  '{"succeeded_without_revenue":0,"succeeded_charge_not_paid":0,"processed_refund_without_reversal":0,"mismatch":1,"duplicate":1,"disputed":0}'::jsonb,
  'reconciliation surfaces exactly the held payments');
select public.detect_incidents();
select is((select count(*)::int from public.incidents where fingerprint in ('billing:payments:mismatch', 'billing:payments:duplicate') and status = 'open' and severity = 'critical'),
  2, 'held payments are critical incidents');

select * from finish();
rollback;
