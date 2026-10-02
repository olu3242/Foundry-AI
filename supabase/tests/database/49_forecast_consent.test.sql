begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000a061', 'owner@consent.test', 'authenticated', 'authenticated');

insert into public.solutions (key, name, summary, target_dimension, target_metric, default_window_days, status)
values ('consent_plan', 'Consent plan', 'Consent boundary regression', 'sales', 'sales_30', 30, 'active');
select id as sol from public.solutions where key = 'consent_plan' \gset
insert into public.solution_versions (solution_id, version, playbook) values (:'sol', 1, '["Follow up"]');
select id as ver from public.solution_versions where solution_id = :'sol' and version = 1 \gset

insert into public.businesses (id, name, country_code, currency, created_by, data_sharing)
select gen_random_uuid(), 'Network ' || g, 'GH', 'GHS', '00000000-0000-0000-0000-00000000a061', 'network'
from generate_series(1, 12) g;
insert into public.businesses (id, name, country_code, currency, created_by, data_sharing)
select gen_random_uuid(), 'Private ' || g, 'GH', 'GHS', '00000000-0000-0000-0000-00000000a061', 'none'
from generate_series(1, 20) g;

insert into public.interventions (business_id, solution_version_id, title, target_metric, expected_direction, baseline_value, window_days, status, due_at, completed_at, created_by, created_by_role)
select id, :'ver', 'Plan', 'sales_30', 'up', 100, 30, 'completed', now(), now(), '00000000-0000-0000-0000-00000000a061', 'owner'
from public.businesses where name like 'Network %' or name like 'Private %';

insert into public.outcomes (intervention_id, business_id, metric, baseline_value, observed_value, delta, improved, window_start, window_end, status)
select i.id, i.business_id, 'sales_30', 100, 120, 20, true, now() - interval '30 days', now(), 'verified'
from public.interventions i;

select id as target from public.businesses where name = 'Network 1' \gset
insert into public.forecasts (business_id, kind, subject_id, horizon_days, method, inputs, input_digest, assumptions, result, confidence, basis)
values (:'target', 'intervention_scenario', :'ver', 30, 'solution_evidence_on_outlook',
  '{"solution":"Consent plan","completed":32,"improved":32,"median_delta":20,"baseline_point":1000}',
  'stale', '[]', '{"scenario_point":1020}', 'medium', 'unfiltered');

select is((select (inputs ->> 'completed')::int from public.forecasts where business_id = :'target' and kind = 'intervention_scenario'), 12,
  'opted-out businesses are excluded from intervention scenario evidence');
select is((select (inputs ->> 'improved')::int from public.forecasts where business_id = :'target' and kind = 'intervention_scenario'), 12,
  'verified improvement count uses only consented businesses');
select is((select method_version from public.forecasts where business_id = :'target' and kind = 'intervention_scenario'), 'fc-v2-consent',
  'forecast records the consent-aware method version');
select ok((select basis like '%consented to network learning' from public.forecasts where business_id = :'target' and kind = 'intervention_scenario'),
  'forecast basis discloses the consent boundary');

select * from finish();
rollback;
