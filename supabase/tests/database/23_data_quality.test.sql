begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000a025', 'owner@b25.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000d025', 'other@b25.test', 'authenticated', 'authenticated');
create function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000a025');
select public.create_business('Quality Shop') as bid \gset
select is(public.data_quality_score(:'bid') -> 'overall', 'null'::jsonb, 'no records → quality unknown, not zero');

-- Six weeks of trading with one silent week (3 weeks ago), a duplicate and oversold stock.
select public.record_entry(:'bid', 'sale', jsonb_build_object('total_minor', 1000, 'occurred_at', date_trunc('week', now()) - (w || ' weeks')::interval + interval '1 day'))
from unnest(array[1, 2, 4, 5, 6]) w;
select public.record_entry(:'bid', 'sale', jsonb_build_object('total_minor', 2500, 'occurred_at', now() - interval '1 hour')) as s1 \gset
select public.record_entry(:'bid', 'sale', jsonb_build_object('total_minor', 2500, 'occurred_at', now() - interval '55 minutes')) as s2 \gset
select public.record_entry(:'bid', 'sale', jsonb_build_object('total_minor', 600, 'items', jsonb_build_array(jsonb_build_object('product_name', 'Soap', 'quantity', 3, 'unit_price_minor', 200))));

select pg_temp.login('00000000-0000-0000-0000-00000000d025');
select throws_ok(format($$ select public.scan_data_quality(%L) $$, :'bid'), '42501', null, 'strangers cannot scan a business');
select pg_temp.login('00000000-0000-0000-0000-00000000a025');
select ok((public.scan_data_quality(:'bid') ->> 'found')::int >= 3, 'scan finds issues');
select is((select count(*)::int from public.data_quality_issues where business_id = :'bid' and kind = 'duplicate'), 1, 'duplicate detected');
select is((select count(*)::int from public.data_quality_issues where business_id = :'bid' and kind = 'conflict'), 1, 'oversold stock detected as a conflict');
select is((select count(*)::int from public.data_quality_issues where business_id = :'bid' and kind = 'missing_period'), 1, 'the silent week is detected');
select is((public.scan_data_quality(:'bid') ->> 'found')::int, 0, 'scans are idempotent');
select ok((public.data_quality_score(:'bid') -> 'dimensions' -> 'completeness' ->> 'score')::numeric < 1, 'completeness reflects the gap');

-- Reconcile without destroying history.
select id as dup from public.data_quality_issues where business_id = :'bid' and kind = 'duplicate' \gset
select throws_ok(format($$ select public.resolve_quality_issue(%L, 'void_duplicate', '{"record_id":"00000000-0000-0000-0000-000000000000"}') $$, :'dup'),
  '22023', null, 'only one of the two records can be voided');
select public.resolve_quality_issue(:'dup', 'void_duplicate', jsonb_build_object('record_id', :'s2'), 'Entered twice');
select is((select voided_at is not null from public.sales where id = :'s2'), true, 'the duplicate is voided');
select is((select count(*)::int from public.sales where id = :'s2'), 1, 'and still kept as evidence');
select id as gap from public.data_quality_issues where business_id = :'bid' and kind = 'missing_period' \gset
select public.resolve_quality_issue(:'gap', 'explain_gap', '{"reason":"travel"}');
select id as neg from public.data_quality_issues where business_id = :'bid' and kind = 'conflict' \gset
select public.resolve_quality_issue(:'neg', 'adjust_stock', '{"counted":2}');
select is((select stock_qty from public.products where business_id = :'bid' and name = 'Soap'), 2.000, 'a stock count reconciles the conflict');
select is((public.data_quality_score(:'bid') -> 'dimensions' -> 'completeness' ->> 'score')::numeric, 1.000, 'an explained gap counts as complete');

-- Correction lineage.
select throws_ok(format($$ select public.correct_record('sale', %L, '{"total_minor":3000}', '') $$, :'s1'), '22023', null, 'corrections need a reason');
select public.correct_record('sale', :'s1', '{"total_minor":3000}', 'Price was 30') as s1b \gset
select is((select supersedes from public.sales where id = :'s1b'), :'s1'::uuid, 'the new record supersedes the original');
select is((select (before ->> 'total_minor')::int || '→' || (after ->> 'total_minor') from public.record_corrections where subject_id = :'s1' and action = 'correct'), '2500→3000', 'before/after are logged');
select is((select count(*)::int from public.record_corrections where business_id = :'bid'), 3, 'every correction is in the lineage');

select * from finish();
rollback;
