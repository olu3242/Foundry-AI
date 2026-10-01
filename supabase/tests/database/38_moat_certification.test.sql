begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000a040', 'owner@b40.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000b040', 'admin@b40.test', 'authenticated', 'authenticated');
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-00000000b040');
create function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000a040');
select throws_ok($$ select public.moat_certification() $$, '42501', null, 'certification is platform-admin only');
select pg_temp.login('00000000-0000-0000-0000-00000000b040');
select ok(public.moat_certification() ?& array['data', 'intelligence', 'solutions', 'network', 'operations', 'economics', 'impact', 'loop', 'loop_status'],
  'every moat dimension is reported');
select is(jsonb_array_length(public.moat_certification() -> 'loop'), 7, 'all seven loop links are checked');
select is((select array_agg(l ->> 'link') from jsonb_array_elements(public.moat_certification() -> 'loop') l),
  array['MORE BUSINESSES', 'MORE TRUSTED RECORDS', 'BETTER INTELLIGENCE', 'BETTER DECISIONS', 'BETTER SOLUTIONS', 'VERIFIED OUTCOMES', 'STRONGER DISTRIBUTION'],
  'in loop order');
select ok(not exists (select 1 from jsonb_array_elements(public.moat_certification() -> 'loop') l where not (l ? 'evidence')), 'every link carries its evidence');

-- With little data the loop cannot pass: insufficient evidence is reported, never assumed.
select isnt(public.moat_certification() ->> 'loop_status', 'PASS', 'the loop does not pass without evidence');
select ok(exists (select 1 from jsonb_array_elements(public.moat_certification() -> 'loop') l where l ->> 'status' = 'insufficient_evidence'),
  'thin data is labelled insufficient_evidence');

-- Verified outcomes link responds to real verified results.
reset role;
insert into public.businesses (id, name, country_code, currency, created_by) values ('00000000-0000-0000-0000-0000000b4040', 'Outcome Co', 'GH', 'GHS', '00000000-0000-0000-0000-00000000a040');
insert into public.interventions (id, business_id, title, target_metric, expected_direction, baseline_value, window_days, status, due_at, created_by, created_by_role)
select gen_random_uuid(), '00000000-0000-0000-0000-0000000b4040', 'Plan ' || g, 'sales_30', 'up', 1, 7, 'completed', now(), '00000000-0000-0000-0000-00000000a040', 'owner' from generate_series(1, 10) g;
insert into public.outcomes (intervention_id, business_id, metric, baseline_value, observed_value, delta, improved, window_start, window_end, status, verified_at)
select id, business_id, 'sales_30', 1, 2, 1, true, now() - interval '7 days', now(), 'verified', now() from public.interventions where business_id = '00000000-0000-0000-0000-0000000b4040';
set local role authenticated;
select is((select l ->> 'status' from jsonb_array_elements(public.moat_certification() -> 'loop') l where l ->> 'link' = 'VERIFIED OUTCOMES'), 'evidenced',
  'ten or more verified improvements evidence the outcome link');

select * from finish();
rollback;
