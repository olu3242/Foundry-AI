begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000a035', 'owner@b35.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000b035', 'admin@b35.test', 'authenticated', 'authenticated');
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-00000000b035');
create function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- Ten program-sourced businesses (90 days old, all activated, six retained, revenue) and five organic.
reset role;
insert into public.businesses (id, name, country_code, currency, created_by, created_at)
select gen_random_uuid(), case when g <= 10 then 'Prog ' else 'Org ' end || g, 'GH', 'GHS', '00000000-0000-0000-0000-00000000a035', now() - interval '90 days'
from generate_series(1, 15) g;
update public.acquisition_attributions a set channel = 'program_code' from public.businesses b where b.id = a.business_id and b.name like 'Prog %';
update public.acquisition_attributions a set attributed_at = now() - interval '90 days' from public.businesses b where b.id = a.business_id and (b.name like 'Prog %' or b.name like 'Org %');
insert into public.events (business_id, type, actor_type, occurred_at)
select id, 'sale.recorded', 'user', created_at + interval '2 days' from public.businesses where name like 'Prog %' or name = 'Org 11';
insert into public.events (business_id, type, actor_type, occurred_at)
select id, 'sale.recorded', 'user', created_at + interval '45 days' from public.businesses where name in ('Prog 1', 'Prog 2', 'Prog 3', 'Prog 4', 'Prog 5', 'Prog 6');
insert into public.revenue_events (source, external_id, business_id, amount_minor, currency, occurred_at)
select 'mobile_money', 'b35-' || id, id, 500, 'USD', now() - interval '10 days' from public.businesses where name like 'Prog %';
insert into public.cost_inputs (month, category, amount_usd) values (date_trunc('month', now()), 'infrastructure', 10);

set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000a035');
select throws_ok($$ select public.channel_economics() $$, '42501', null, 'channel economics are platform-admin only');
select pg_temp.login('00000000-0000-0000-0000-00000000b035');
select public.add_channel_cost('program_code', date_trunc('month', now() - interval '2 months')::date, 20, 'Field agent stipends for program onboarding');

create temp table ch as select c from jsonb_array_elements(public.channel_economics(6) -> 'channels') c;
select is((select (c ->> 'acquired')::int from ch where c ->> 'channel' = 'program_code'), 10, 'acquisition counted by channel');
select is((select (c ->> 'activation_rate')::numeric from ch where c ->> 'channel' = 'program_code'), 1.000, 'activation from real records');
select is((select (c ->> 'retention_30_60')::numeric from ch where c ->> 'channel' = 'program_code'), 0.600, 'retention measured on eligible businesses');
select is((select (c ->> 'revenue_usd')::numeric from ch where c ->> 'channel' = 'program_code'), 50.00, 'revenue attributed through the business');
select is((select (c ->> 'cac_usd')::numeric from ch where c ->> 'channel' = 'program_code'), 2.00, 'CAC = evidenced acquisition cost ÷ acquired');
select ok((select (c ->> 'payback_months')::numeric > 0 from ch where c ->> 'channel' = 'program_code'), 'payback computed when contribution is positive');
select is((select c ->> 'cac_usd' from ch where c ->> 'channel' = 'organic'), null, 'no acquisition-cost evidence → no CAC');
select ok((select c -> 'notes' ->> 'cac' like 'No acquisition cost recorded%' from ch where c ->> 'channel' = 'organic'), 'and the reason is stated');

select * from finish();
rollback;
