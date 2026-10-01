begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000a037', 'owner@b37.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000b037', 'admin@b37.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000d037', 'other@b37.test', 'authenticated', 'authenticated');
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-00000000b037');
create function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- Seven bakeries in Rwanda trade this month; one opts out. Two tailors (too few to show).
reset role;
insert into public.businesses (id, name, sector, country_code, currency, created_by)
select gen_random_uuid(), 'Bakery ' || g, 'Bakery', 'RW', 'RWF', '00000000-0000-0000-0000-00000000a037' from generate_series(1, 7) g;
insert into public.businesses (id, name, sector, country_code, currency, created_by)
select gen_random_uuid(), 'Tailor ' || g, 'Tailoring', 'RW', 'RWF', '00000000-0000-0000-0000-00000000a037' from generate_series(1, 2) g;
insert into public.memberships (business_id, user_id, role) select id, '00000000-0000-0000-0000-00000000a037', 'owner' from public.businesses where name = 'Bakery 1';
insert into public.sales (business_id, total_minor, amount_paid_minor, currency, occurred_at)
select id, 10000, 10000, 'RWF', now() - interval '1 day' from public.businesses where name like 'Bakery %' or name like 'Tailor %';
select id as b1 from public.businesses where name = 'Bakery 1' \gset

set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000d037');
select throws_ok(format($$ select public.set_data_sharing(%L, false) $$, :'b1'), '42501', null, 'only the owner decides on network use');
select pg_temp.login('00000000-0000-0000-0000-00000000a037');
select public.set_data_sharing(:'b1', false);
select throws_ok($$ select public.build_dataset('operating_patterns') $$, '42501', null, 'datasets are built by the platform only');

select pg_temp.login('00000000-0000-0000-0000-00000000b037');
select public.build_dataset('operating_patterns') as build \gset
reset role;
select ok((select excluded_opt_out >= 1 from public.dataset_builds where id = :'build'), 'opted-out businesses are excluded');
select is((select (r ->> 'n')::int from public.dataset_builds, jsonb_array_elements(data) r where id = :'build' and r ->> 'country_code' = 'RW' and r ->> 'sector' = 'Bakery'),
  6, 'the bakery group counts only consenting businesses');
select is((select count(*)::int from public.dataset_builds, jsonb_array_elements(data) r where id = :'build' and r ->> 'sector' = 'Tailoring'), 0,
  'groups under the minimum size are suppressed');
select ok((select suppressed >= 1 from public.dataset_builds where id = :'build'), 'and counted as suppressed');
select ok((select digest is not null from public.dataset_builds where id = :'build'), 'builds are fingerprinted');

set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000b037');
select is(public.read_dataset('operating_patterns', 'credit_scoring') ->> 'error', 'purpose_not_permitted', 'reads outside the declared purposes are refused');
select ok((public.read_dataset('operating_patterns', 'benchmarks') -> 'rows') is not null, 'reads for a declared purpose work');
reset role;
select is((select count(*)::int from public.dataset_access_log where dataset_key = 'operating_patterns' and purpose = 'credit_scoring' and not allowed), 1,
  'refusals are logged');
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000b037');
select ok(public.feature_lineage('intervention_outcomes.verified_improved_rate') ?& array['source', 'transformation', 'feature', 'use'],
  'every feature traces SOURCE → TRANSFORMATION → FEATURE → USE');

-- Opt-out reaches existing cross-business features (B18 ranking).
reset role;
insert into public.solution_versions (solution_id, version, playbook) select id, 9, '[]' from public.solutions where key = 'daily_record_habit';
insert into public.interventions (business_id, solution_version_id, title, target_metric, expected_direction, baseline_value, window_days, status, due_at, created_by, created_by_role)
select :'b1', v.id, 'Habit', 'active_days_30', 'up', 1, 14, 'completed', now(), '00000000-0000-0000-0000-00000000a037', 'owner'
from public.solution_versions v join public.solutions s on s.id = v.solution_id where s.key = 'daily_record_habit' and v.version = 9;
select is((select completed from public.solution_rank_stats() r join public.solution_versions v on v.id = r.solution_version_id where v.version = 9), 0,
  'an opted-out business does not feed network ranking');

select * from finish();
rollback;
