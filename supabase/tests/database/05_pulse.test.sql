begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000e1', 'owner@pulse.test', 'authenticated', 'authenticated');
create function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-0000000000e1');
select public.create_business('Pulse Shop', null, 'KE', 'KES', 'Africa/Nairobi') as bid \gset
select public.record_entry(:'bid', 'sale', format('{"occurred_at":"%s","payment_method":"credit","total_minor":10000,"amount_paid_minor":4000,"customer_name":"Wanjiru"}', now() - interval '40 days')::jsonb);
select public.record_entry(:'bid', 'sale', '{"payment_method":"cash","total_minor":20000,"customer_name":"Wanjiru"}');
select public.record_entry(:'bid', 'sale', '{"payment_method":"mobile_money","total_minor":5000,"customer_name":"Otieno"}');
select public.record_entry(:'bid', 'expense', '{"category":"Rent","amount_minor":8000,"payment_method":"cash"}');

select is((select count(*)::int from public.jobs where dedupe_key = 'pulse:' || :'bid'), 1, 'record bursts collapse into one debounced pulse job');
select throws_ok(format($$ select public.pulse_metrics(%L) $$, :'bid'), '42501', null, 'metrics are service-only');

reset role;
set local role service_role;
select public.pulse_metrics(:'bid') as m \gset
select is((:'m'::jsonb ->> 'sales_30')::int, 25000, 'sales in the last 30 days');
select is((:'m'::jsonb ->> 'sales_prev_30')::int, 10000, 'sales in the previous 30 days');
select is((:'m'::jsonb ->> 'receivable_over_30')::int, 6000, 'old unpaid credit is overdue');
select is((:'m'::jsonb ->> 'repeat_customers_60')::int, 1, 'repeat customers within 60 days');

select * from finish();
rollback;
