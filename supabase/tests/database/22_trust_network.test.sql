begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000a024', 'owner@b24.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000b024', 'admin@b24.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000c024', 'verifier@b24.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000d024', 'other@b24.test', 'authenticated', 'authenticated');
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-00000000b024');
create function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000a024');
select public.create_business('Trust Shop', null, 'GH', 'GHS') as bid \gset
select public.record_entry(:'bid', 'sale', jsonb_build_object('payment_method', 'cash', 'total_minor', 50000, 'occurred_at', now() - interval '10 days', 'notes', 'Sold to Auntie Ama'));
select public.record_entry(:'bid', 'sale', jsonb_build_object('payment_method', 'mobile_money', 'total_minor', 30000, 'occurred_at', now() - interval '5 days'));
select public.set_business_identifier(:'bid', 'ghana_card', 'GHA-123456789-0');

select pg_temp.login('00000000-0000-0000-0000-00000000c024');
select public.register_verifier('Accra Audit Co', 'auditor', array['sales_total_period', 'registration'], 'ICAG member') as vid \gset
select pg_temp.login('00000000-0000-0000-0000-00000000a024');
select throws_ok(format($$ select public.request_verification(%L, %L, 'sales_total_period', '{"period_start":"2000-01-01","period_end":"2000-02-01"}', true) $$, :'bid', :'vid'),
  'P0001', null, 'unapproved verifiers cannot be asked');
select pg_temp.login('00000000-0000-0000-0000-00000000b024');
select public.review_verifier(:'vid', 'approved');

select pg_temp.login('00000000-0000-0000-0000-00000000a024');
select throws_ok(format($$ select public.request_verification(%L, %L, 'sales_total_period', %L, false) $$, :'bid', :'vid',
  jsonb_build_object('period_start', current_date - 30, 'period_end', current_date)), 'P0001', null, 'verification needs consent');
select public.request_verification(:'bid', :'vid', 'sales_total_period', jsonb_build_object('period_start', current_date - 30, 'period_end', current_date), true) as rid \gset
select is((select (claim ->> 'total_minor')::int from public.verification_requests where id = :'rid'), 80000, 'the claim is computed from the books');

-- Minimum necessary information.
select pg_temp.login('00000000-0000-0000-0000-00000000d024');
select throws_ok(format($$ select public.verification_request_evidence(%L) $$, :'rid'), '42501', null, 'other people cannot see the evidence');
select pg_temp.login('00000000-0000-0000-0000-00000000c024');
select is(jsonb_array_length(public.verification_request_evidence(:'rid') -> 'records'), 2, 'the verifier sees exactly the scoped records');
select ok(public.verification_request_evidence(:'rid')::text not like '%Auntie%', 'no notes or customer details are exposed');
select is((select count(*)::int from public.sales where business_id = :'bid'), 0, 'the verifier has no direct access to the books');

select public.attest_claim(:'rid', 'confirmed', 'mobile_money_statement', 'Matched MoMo statement') as aid \gset
select throws_ok(format($$ select public.verification_request_evidence(%L) $$, :'rid'), 'P0001', null, 'evidence access ends after attesting');
select throws_ok(format($$ select public.attest_claim(%L, 'confirmed', 'records_review') $$, :'rid'), 'P0001', null, 'a request is attested once');

-- Registration claims flip the identifier to verified.
select pg_temp.login('00000000-0000-0000-0000-00000000a024');
select public.request_verification(:'bid', :'vid', 'registration', '{"type":"ghana_card"}', true) as rid2 \gset
select pg_temp.login('00000000-0000-0000-0000-00000000c024');
select public.attest_claim(:'rid2', 'confirmed', 'registry_check');
select pg_temp.login('00000000-0000-0000-0000-00000000a024');
select is((select verified from public.business_identifiers where business_id = :'bid' and type = 'ghana_card'), true, 'confirmed registration marks the identifier verified');

-- Dispute → correction keeps history.
select public.dispute_attestation(:'aid', 'The total missed a cancelled sale') as did \gset
select is((select status from public.attestations where id = :'aid'), 'disputed', 'disputes mark the attestation');
select throws_ok(format($$ select public.resolve_dispute(%L, 'upheld', 'x') $$, :'did'), '42501', null, 'only platform admins resolve disputes');
select pg_temp.login('00000000-0000-0000-0000-00000000c024');
select public.correct_attestation(:'aid', 'partially_confirmed', 'One sale could not be matched') as aid2 \gset
select pg_temp.login('00000000-0000-0000-0000-00000000a024');
select is((select status from public.attestations where id = :'aid'), 'corrected', 'corrected attestations are kept, not deleted');
select is((select supersedes from public.attestations where id = :'aid2'), :'aid'::uuid, 'the correction links to what it replaces');
select is((select status from public.attestation_disputes where id = :'did'), 'upheld', 'a correction settles the dispute');
select is(jsonb_array_length(public.verification_history(:'bid')), 3, 'history shows every attestation');
select hasnt_column('public', 'businesses', 'trusted', 'there is no blanket trusted status');

select * from finish();
rollback;
