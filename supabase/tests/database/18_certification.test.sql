begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

-- Security and performance certification (runs in CI on every change).
select is(public.security_report() -> 'tables_without_rls', '[]'::jsonb, 'every public table has RLS');
select is(public.security_report() -> 'anon_table_grants', '[]'::jsonb, 'anon has no table grants');
select is(public.security_report() -> 'definer_functions_callable_by_anon', '[]'::jsonb, 'no definer function is callable by anon');
select is(public.security_report() -> 'definer_functions_without_search_path', '[]'::jsonb, 'every definer function pins search_path');
select is(public.security_report() -> 'business_id_without_index', '[]'::jsonb, 'every business_id is indexed');

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000a018', 'owner@scale.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000b018', 'admin@scale.test', 'authenticated', 'authenticated');
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-00000000b018');
create function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000a018');
select public.create_business('Scale Shop', null, 'GH', 'GHS') as bid \gset
select public.record_entry(:'bid', 'sale', '{"payment_method":"cash","total_minor":100000}');
select public.start_intervention(:'bid', 'Grow', 'sales_30', 7) as iid \gset
select public.complete_intervention(:'iid');
reset role;
insert into public.outcomes (intervention_id, business_id, metric, baseline_value, observed_value, delta, improved, window_start, window_end, status, verified_at)
values (:'iid', :'bid', 'sales_30', 100000, 300000, 200000, true, now(), now(), 'verified', now());
insert into public.revenue_events (external_id, amount_minor, currency) values ('in_test', 5000, 'USD');
insert into public.cost_inputs (month, category, amount_usd) values (date_trunc('month', now()), 'infrastructure', 20);

set local role authenticated;
select throws_ok($$ select public.scale_metrics() $$, '42501', null, 'scale metrics are platform-admin only');
select pg_temp.login('00000000-0000-0000-0000-00000000b018');
select is((public.scale_metrics() -> 'impact_usd' ->> 'verified_incremental_revenue')::numeric, 130.00, 'verified revenue impact converted to USD (GH₵2,000 × 0.065)');
select is((public.scale_metrics() -> 'impact_usd' ->> 'vei')::numeric, 130.00, 'VEI sums verified components');
select is((public.scale_metrics() -> 'economics_usd' ->> 'gross_contribution')::numeric, 30.00, 'gross contribution = revenue − AI − costs');
select ok((public.scale_metrics() -> 'data_moat' ->> 'outcomes')::int >= 1, 'data moat counts outcomes');
select is((public.integrity_report() ->> 'sales_items_mismatch')::int, 0, 'books are internally consistent');

reset role;
update public.sales set amount_paid_minor = 1 where business_id = :'bid';
insert into public.sale_items (business_id, sale_id, description, quantity, unit_price_minor, line_total_minor)
select business_id, id, 'x', 1, 5, 5 from public.sales where business_id = :'bid';
select is((public.integrity_report() ->> 'sales_items_mismatch')::int, 1, 'integrity report detects a planted mismatch');

select * from finish();
rollback;
