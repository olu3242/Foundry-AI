begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

insert into auth.users (id, email, phone, aud, role) values
  ('00000000-0000-0000-0000-00000000a046', 'owner@b46.test', '233240000046', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000b046', 'admin@b46.test', null, 'authenticated', 'authenticated');
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-00000000b046');
create function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.outcome(bid uuid, improved boolean) returns uuid language sql as $$
  with i as (insert into public.interventions (business_id, title, target_metric, expected_direction, baseline_value, due_at, created_by, created_by_role)
             values (bid, 'Cut spoilage', 'sales_30', 'up', 100, now(), '00000000-0000-0000-0000-00000000a046', 'owner') returning id)
  insert into public.outcomes (intervention_id, business_id, metric, baseline_value, observed_value, delta, improved, window_start, window_end, status)
  select id, bid, 'sales_30', 100, case when improved then 130 else 90 end, case when improved then 30 else -10 end, improved, now() - interval '14 days', now(), 'verified' from i
  returning id;
$$;

-- Local environment: test data, whatever it looks like, never becomes evidence.
update public.platform_settings set value = '"local"' where key = 'environment';
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000a046');
select public.create_business('Demo Stall', null, 'GH', 'GHS') as demo \gset
reset role;
select pg_temp.outcome(:'demo', true);
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000b046');
select is((public.harvest_evidence() ->> 'upserted')::int, 0, 'a verified outcome on test data is not harvested');
select is(public.real_world_certification() ->> 'overall', 'INSUFFICIENT EVIDENCE', 'local data certifies as insufficient evidence');
select throws_ok(format($$ select public.register_evidence(%L, 'B47', 'Sales up 30%%', 'document:fake', current_date, 'third_party_verified', 'improved', 'high') $$, :'demo'),
  'P0001', 'Test or demo data can never be evidence', 'manual evidence about test data is refused');
select throws_ok($$ select public.register_evidence(null, 'B49', 'Sponsor signed for 200 seats', 'contract:x-1', current_date, 'third_party_verified', 'signed', 'high') $$,
  'P0001', 'Cohort-level evidence can only be recorded in production', 'cohort evidence only in production');
reset role;

-- Production: real, consenting business.
update public.platform_settings set value = '"production"' where key = 'environment';
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000a046');
select public.create_business('Real Stall', null, 'GH', 'GHS') as bid \gset
select public.set_data_sharing(:'bid', false);
reset role;
select pg_temp.outcome(:'bid', true) as o1 \gset
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000b046');
select is((public.harvest_evidence() ->> 'upserted')::int, 0, 'no consent → not evidence, even when real');
select pg_temp.login('00000000-0000-0000-0000-00000000a046');
select public.set_data_sharing(:'bid', true);
select pg_temp.login('00000000-0000-0000-0000-00000000b046');
select is((public.harvest_evidence() ->> 'upserted')::int, 2, 'real + consented: the verified outcome (B47) and how the business arrived (B49) are harvested');
select is((select batch || ':' || verification_state || ':' || confidence || ':' || consent_scope from public.evidence_register where source = 'outcome:' || :'o1'),
  'B47:partner_verified:high:network_learning', 'register fields: batch, verification, confidence, consent scope');
select is((public.harvest_evidence() ->> 'upserted')::int, 1, 'harvest is idempotent per source (refresh only)');
select is((select count(*)::int from public.evidence_register where source = 'outcome:' || :'o1'), 1, 'one row per source');

select throws_ok(format($$ select public.register_evidence(%L, 'B48', 'Lender approved a loan', 'whatsapp chat', current_date, 'third_party_verified', 'approved', 'high') $$, :'bid'),
  '22023', null, 'manual evidence must cite a document');
select throws_ok(format($$ select public.register_evidence(%L, 'B48', 'Lender approved a loan', 'letter:bank-2026-01', current_date + 3, 'third_party_verified', 'approved', 'high') $$, :'bid'),
  '22023', null, 'evidence cannot be future-dated');
select lives_ok(format($$ select public.register_evidence(%L, 'B48', 'Lender approved a loan using the Passport', 'letter:bank-2026-01', current_date, 'third_party_verified', 'approved', 'high') $$, :'bid'),
  'documented evidence about a real business is accepted');

-- Certification: small n can only be partial; technical status never upgrades it.
select is((select x ->> 'status' from jsonb_array_elements(public.real_world_certification() -> 'claims') x where x ->> 'claim' = 'outcomes'), 'PARTIALLY PROVEN',
  '1 verified improvement < minimum sample → partially proven');
select is((select x ->> 'status' from jsonb_array_elements(public.real_world_certification() -> 'claims') x where x ->> 'claim' = 'unit_economics'), 'INSUFFICIENT EVIDENCE',
  'money is never certified on placeholder FX');
reset role;
update public.platform_settings set value = jsonb_set(value, '{outcomes}', '{"min_n": 1, "proven": 0.5, "failed": 0.6}') where key = 'certification_thresholds';
select pg_temp.outcome(:'bid', false);
select pg_temp.outcome(:'bid', false);
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000b046');
select is(public.real_world_certification() ->> 'overall', 'FAILED', 'a claim that fails its threshold fails the certification');
select public.certify_real_world() as cid \gset
select is((select overall || ':' || (result ->> 'technical' is not null) from public.real_world_certifications where id = :'cid'), 'FAILED:true', 'certifications are snapshotted with technical status alongside');
select pg_temp.login('00000000-0000-0000-0000-00000000a046');
select throws_ok($$ select public.real_world_certification() $$, '42501', null, 'admins only');

select * from finish();
rollback;
