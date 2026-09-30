begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000a017', 'owner@mm.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000b017', 'admin@mm.test', 'authenticated', 'authenticated');
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-00000000b017');
create function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000a017');
select public.create_business('Dakar Boutique', null, 'SN', 'USD') as sn \gset
select results_eq(format($$ select currency, timezone, locale from public.businesses where id = %L $$, :'sn'),
  $$ values ('XOF'::text, 'Africa/Dakar'::text, 'fr'::text) $$, 'market sets currency, timezone and language');
select throws_ok($$ select public.create_business('Kampala Shop', null, 'UG', 'UGX') $$, 'P0001', 'Foundry is not available in that country yet', 'unconfigured countries are rejected');
select throws_ok(format($$ select public.set_business_identifier(%L, 'ninea', 'bad!') $$, :'sn'), 'P0001', null, 'identifiers are validated per market');
select lives_ok(format($$ select public.set_business_identifier(%L, 'ninea', '1234567A2B') $$, :'sn'), 'valid NINEA accepted');
select throws_ok(format($$ select public.set_business_identifier(%L, 'kra_pin', 'A123456789B') $$, :'sn'), 'P0001', null, 'other countries'' identifiers are refused');
select throws_ok($$ select public.upsert_market('{"country_code":"UG"}') $$, '42501', null, 'only platform admins configure markets');

select pg_temp.login('00000000-0000-0000-0000-00000000b017');
select public.upsert_market('{"country_code":"UG","name":"Uganda","currency":"UGX","default_timezone":"Africa/Kampala","phone_prefix":"256",
  "identifier_types":[{"key":"ursb","label":"URSB registration","pattern":"^[0-9]{6,14}$"}],"connectors":{"mobile_money":["MTN MoMo","Airtel Money"]},"status":"active"}');
select pg_temp.login('00000000-0000-0000-0000-00000000a017');
select public.create_business('Kampala Shop', null, 'UG', 'UGX') as ug \gset
select is((select currency from public.businesses where id = :'ug'), 'UGX', 'a new market works without code changes');
select lives_ok(format($$ select public.set_business_identifier(%L, 'ursb', '80020001234') $$, :'ug'), 'new market identifiers work');

reset role;
update public.markets set data_residency = 'af-south' where country_code = 'KE';
select set_config('app.data_region', 'eu-west', true);
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000a017');
select throws_ok($$ select public.create_business('Nairobi Shop', null, 'KE', 'KES') $$, 'P0001', null, 'data residency is enforced per market');
select set_config('app.data_region', 'af-south', true);
select lives_ok($$ select public.create_business('Nairobi Shop', null, 'KE', 'KES') $$, 'the right region accepts it');

select * from finish();
rollback;
