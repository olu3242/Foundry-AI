begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000a014', 'lender@fin.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000b014', 'owner@fin.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000c014', 'other-lender@fin.test', 'authenticated', 'authenticated');
create function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000a014');
select public.create_program('Stock Finance Co') as pid \gset
select throws_ok(format($$ select public.create_financial_product(%L, 'Loan', 'working_capital', 'NGN', 0, 100, '{}') $$, :'pid'),
  '42501', null, 'only lender programs list products');
update public.programs set kind = 'lender' where id = :'pid';
select public.create_financial_product(:'pid', 'Stock loan', 'stock_financing', 'NGN', 5000000, 50000000,
  '{"countries":["NG"],"min_months_records":1,"min_proof_level":"document_backed"}') as fid \gset

select pg_temp.login('00000000-0000-0000-0000-00000000b014');
select public.create_business('Borrower Ltd', 'Retail / provisions', 'NG', 'NGN') as bid \gset
select public.record_entry(:'bid', 'sale', '{"payment_method":"cash","total_minor":100000}');
select is((public.product_eligibility(:'bid', :'fid') ->> 'eligible')::boolean, false, 'not eligible without document-backed proof');
select is((select count(*)::int from jsonb_array_elements(public.product_eligibility(:'bid', :'fid') -> 'checks') c where not (c ->> 'pass')::boolean), 1,
  'eligibility names the single missing requirement');
select ok(public.product_eligibility(:'bid', :'fid') ? 'note' and not (public.product_eligibility(:'bid', :'fid') ? 'score'), 'no score is produced');
select throws_ok(format($$ select public.submit_evidence_package(%L, %L, array['summary'], 1000, 'stock', false) $$, :'bid', :'fid'),
  'P0001', null, 'sharing requires consent');
select public.submit_evidence_package(:'bid', :'fid', array['summary'], 10000000, 'Restock for festive season', true) as pkg \gset
select is((select sections from public.evidence_packages where id = :'pkg'), array['proof', 'summary', 'track_record'], 'required sections are always included');
select ok((select not (snapshot ? 'pulse') from public.evidence_packages where id = :'pkg'), 'unchosen sections do not leave');

select pg_temp.login('00000000-0000-0000-0000-00000000a014');
select is((select count(*)::int from public.sales where business_id = :'bid'), 0, 'lenders cannot read the business''s books');
select is((select count(*)::int from public.evidence_packages where id = :'pkg'), 1, 'lender sees the package');
select public.decide_evidence_package(:'pkg', 'approved', 'Approved for 80k', 8000000);

select pg_temp.login('00000000-0000-0000-0000-00000000c014');
select is((select count(*)::int from public.evidence_packages), 0, 'other partners see nothing');

select pg_temp.login('00000000-0000-0000-0000-00000000b014');
select is((select status::text from public.evidence_packages where id = :'pkg'), 'approved', 'decision returns to the business');
select public.withdraw_evidence_package(:'pkg');
select pg_temp.login('00000000-0000-0000-0000-00000000a014');
select is((select count(*)::int from public.evidence_packages where id = :'pkg'), 0, 'withdrawn packages disappear for the partner');

select * from finish();
rollback;
