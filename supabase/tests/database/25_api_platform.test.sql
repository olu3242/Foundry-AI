begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000a027', 'owner@b27.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000c027', 'progadmin@b27.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000d027', 'other@b27.test', 'authenticated', 'authenticated');
create function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000c027');
select public.create_program('API Program') as pid \gset
select join_code as code from public.programs where id = :'pid' \gset
select pg_temp.login('00000000-0000-0000-0000-00000000a027');
select public.create_business('Enrolled Co') as b_in \gset
select public.create_business('Private Co') as b_out \gset
select public.join_program(:'b_in', :'code', true);

select pg_temp.login('00000000-0000-0000-0000-00000000d027');
select throws_ok(format($$ select public.create_service_identity(%L, 'x', array['businesses:read']) $$, :'pid'), '42501', null, 'only program admins create keys');
select pg_temp.login('00000000-0000-0000-0000-00000000c027');
select public.create_service_identity(:'pid', 'CRM sync', array['businesses:read', 'events:subscribe', 'invitations:write']) as ident \gset
select ok((:'ident'::jsonb ->> 'key') like 'fdy_live_%', 'live key issued once');
select throws_ok(format($$ select public.create_webhook_subscription(%L, 'http://insecure.test/hook', array['outcome.verified']) $$, :'ident'::jsonb ->> 'id'),
  '22023', null, 'live webhooks must use https');
select public.create_webhook_subscription((:'ident'::jsonb ->> 'id')::uuid, 'https://crm.example/hook', array['intervention.started']);
select public.create_sandbox_program(:'pid') as sandbox \gset
select is((public.create_service_identity(:'sandbox', 'Test key', array['businesses:read']) ->> 'environment'), 'sandbox', 'sandbox programs issue sandbox keys');

-- No direct database access for anyone but the service.
select throws_ok($$ select * from public.service_identities $$, '42501', null, 'keys are not readable directly');
select throws_ok(format($$ select public.api_list_businesses(%L) $$, :'ident'::jsonb ->> 'id'), '42501', null, 'API functions are not callable by users');

reset role;
set local role service_role;
select is((public.api_authenticate(encode(extensions.digest(:'ident'::jsonb ->> 'key', 'sha256'), 'hex')) ->> 'program_id')::uuid, :'pid'::uuid, 'a valid key resolves to its program');
select is(public.api_authenticate(encode(extensions.digest('fdy_live_wrong', 'sha256'), 'hex')), null, 'an unknown key resolves to nothing');
select is(jsonb_array_length(public.api_list_businesses((:'ident'::jsonb ->> 'id')::uuid)), 1, 'only consented, enrolled businesses are visible');
select is(public.api_list_businesses((:'ident'::jsonb ->> 'id')::uuid) -> 0 ->> 'name', 'Enrolled Co', 'and it is the right one');
select throws_ok(format($$ select public.api_program_report(%L) $$, :'ident'::jsonb ->> 'id'), '42501', null, 'scopes are enforced');
select is(public.api_invite((:'ident'::jsonb ->> 'id')::uuid, array['+233 20 000 1111', '233200001111', 'x']), 1, 'bounded write: invitations deduplicated and validated');

-- Webhook fan-out follows consent.
reset role;
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000a027');
select public.start_intervention(:'b_in', 'Promo', 'sales_30', 7);
select public.start_intervention(:'b_out', 'Promo', 'sales_30', 7);
reset role;
select is((select count(*)::int from public.webhook_deliveries where event_type = 'intervention.started'), 1, 'only the enrolled business event is delivered');
select is((select count(*)::int from public.jobs where type = 'webhook.deliver'), 1, 'delivery is queued with retries');

set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000c027');
select public.revoke_service_identity((:'ident'::jsonb ->> 'id')::uuid);
reset role;
set local role service_role;
select is(public.api_authenticate(encode(extensions.digest(:'ident'::jsonb ->> 'key', 'sha256'), 'hex')), null, 'revoked keys stop working');
reset role;
select is((select count(*)::int from public.audit_log where table_name = 'service_identities' and row_id = :'ident'::jsonb ->> 'id'), 2, 'key lifecycle is audited');

select * from finish();
rollback;
