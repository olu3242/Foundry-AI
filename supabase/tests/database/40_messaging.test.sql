begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

insert into auth.users (id, email, phone, aud, role) values
  ('00000000-0000-0000-0000-00000000a042', 'owner@b42.test', '233240000042', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000d042', 'other@b42.test', null, 'authenticated', 'authenticated');
update public.platform_settings set value = '{"quiet_start": 0, "quiet_end": 0, "max_per_business_per_day": 2}' where key = 'messaging';
create function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000a042');
select public.create_business('Message Shop', null, 'GH', 'GHS') as bid \gset
reset role;

-- No consent → nothing leaves Foundry; the decision is still recorded.
select private.queue_message(:'bid', 'record_request', '{"business_name":"Message Shop","last_record":"01 Oct"}', 'test', '1', 'c1') as m1 \gset
select is((select status || ':' || suppression_reason from public.messages where id = :'m1'), 'suppressed:no_consent', 'no consent → suppressed with reason');

set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000d042');
select throws_ok(format($$ select public.set_message_consent(%L, 'whatsapp', true) $$, :'bid'), '42501', null, 'only the owner gives consent');
select pg_temp.login('00000000-0000-0000-0000-00000000a042');
select public.set_message_consent(:'bid', 'sms', true);
select public.set_message_consent(:'bid', 'whatsapp', true);
reset role;

select private.queue_message(:'bid', 'record_request', '{"business_name":"Message Shop","last_record":"01 Oct"}', 'test', '2', 'c2') as m2 \gset
select is((select channel || ':' || status from public.messages where id = :'m2'), 'whatsapp:queued', 'WhatsApp preferred when consented');
select is((select body from public.messages where id = :'m2'), 'Hello from Foundry. Nothing has been recorded for Message Shop since 01 Oct. Reply with what you sold and spent, or open Foundry. Reply STOP to stop messages.',
  'template rendered with variables');
select is((select count(*)::int from public.jobs where dedupe_key = 'msg:' || :'m2'), 1, 'delivery is queued as a retrying job');
select is(private.queue_message(:'bid', 'record_request', '{}', 'test', '2', 'c2'), :'m2'::uuid, 'idempotent per correlation id');
select private.queue_message(:'bid', 'plan_reminder', '{"plan":"X"}', 'test', '3', 'c3') as m3 \gset
select is((select status || ':' || suppression_reason from public.messages where id = :'m3'), 'suppressed:missing_variables', 'messages with missing variables never go out');
select private.queue_message(:'bid', 'plan_reminder', '{"plan":"Push","due":"03 Oct"}', 'test', '4', 'c4');
select private.queue_message(:'bid', 'plan_reminder', '{"plan":"Push","due":"03 Oct"}', 'test', '5', 'c5') as m5 \gset
select is((select suppression_reason from public.messages where id = :'m5'), 'rate_limited', 'per-business daily rate control');

-- Quiet hours in the business's timezone.
update public.platform_settings set value = '{"quiet_start": 20, "quiet_end": 7, "max_per_business_per_day": 10}' where key = 'messaging';
update public.businesses set timezone = 'Africa/Lagos' where id = :'bid';
select is(private.after_quiet_hours(:'bid', '2026-10-01 22:30:00+01'::timestamptz), '2026-10-02 07:00:00+01'::timestamptz, 'late evening waits until 07:00 next day');
select is(private.after_quiet_hours(:'bid', '2026-10-01 05:00:00+01'::timestamptz), '2026-10-01 07:00:00+01'::timestamptz, 'early morning waits until 07:00');
select is(private.after_quiet_hours(:'bid', '2026-10-01 12:00:00+01'::timestamptz), '2026-10-01 12:00:00+01'::timestamptz, 'daytime sends now');

-- Delivery receipts: forward-only, idempotent.
set local role service_role;
select public.record_message_send(:'m2', 'whatsapp_cloud', 'wamid.1', '', false);
select public.record_message_receipt('whatsapp_cloud', 'wamid.1', 'delivered', 'ev1', '{}');
select public.record_message_receipt('whatsapp_cloud', 'wamid.1', 'sent', 'ev0', '{}');
select public.record_message_receipt('whatsapp_cloud', 'wamid.1', 'delivered', 'ev1', '{}');
reset role;
select is((select status from public.messages where id = :'m2'), 'delivered', 'late "sent" receipts never move status backwards');
select is((select count(*)::int from public.message_events where message_id = :'m2'), 2, 'duplicate receipts are ignored');

-- Inbound STOP opts the phone out everywhere.
set local role service_role;
select is(public.record_inbound_message('whatsapp_cloud', '+233 24 000 0042', 'stop', 'in1'), 'opted_out', 'STOP is honoured');
reset role;
select is((select count(*)::int from public.communication_consents where business_id = :'bid' and status = 'opted_in'), 0, 'all channels opted out');

select * from finish();
rollback;
