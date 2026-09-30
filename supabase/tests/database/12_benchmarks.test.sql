begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email, aud, role) values ('00000000-0000-0000-0000-00000000a012', 'bench@b.test', 'authenticated', 'authenticated');
create function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000a012');

-- 12 comparable retailers in NG (enough), 3 in RW (not enough).
do $$
declare bid uuid; k int; j int;
begin
  for k in 1..15 loop
    bid := public.create_business('Bench ' || k, 'Retail / provisions', case when k <= 12 then 'NG' else 'RW' end, case when k <= 12 then 'NGN' else 'RWF' end);
    for j in 1..6 loop
      perform public.record_entry(bid, 'sale', jsonb_build_object('payment_method', 'cash', 'total_minor', 1000 * k,
        'occurred_at', now() - make_interval(days => j)));
    end loop;
    perform public.record_entry(bid, 'expense', jsonb_build_object('category', 'Rent', 'amount_minor', 500 * k, 'payment_method', 'cash'));
  end loop;
end $$;
select id as bid from public.businesses where name = 'Bench 5' \gset
select id as small from public.businesses where name = 'Bench 13' \gset

reset role; set local role service_role;
select ok(public.compute_benchmarks() > 0, 'benchmarks computed');
select is((select n from public.benchmarks where cohort_key = 'country_sector|NG|Retail / provisions' and metric = 'margin'), 12, 'cohort sample size');
select is((select confidence from public.benchmarks where cohort_key = 'country_sector|NG|Retail / provisions' and metric = 'margin'), 'low', '12 businesses = low confidence');
select is((select p50 from public.benchmarks where cohort_key = 'country|RW' and metric = 'margin'), null, 'below the minimum sample no percentiles are stored');

set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000a012');
select is((select count(*)::int from public.benchmarks where country_code = 'RW'), 0, 'unconfident cohorts are hidden');
select ok((select p50 is not null and placement is null from public.business_benchmark(:'bid') where metric = 'margin'),
  'low confidence shows percentiles but no position');
select is((select confidence from public.business_benchmark(:'small') where metric = 'margin'), 'none', 'small markets report no confidence');
select throws_ok($$ select * from public.business_benchmark('00000000-0000-0000-0000-000000000000') $$, '42501', null, 'benchmarks follow business access');

select * from finish();
rollback;
