begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000a029', 'owner@b29.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000b029', 'admin@b29.test', 'authenticated', 'authenticated');
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-00000000b029');
insert into public.solutions (key, name, summary, target_dimension, target_metric, default_window_days, status)
values ('exp_push', 'Experimental push', 'Sales push', 'sales', 'sales_30', 14, 'active');
select id as sol from public.solutions where key = 'exp_push' \gset
insert into public.solution_versions (solution_id, version, playbook) values (:'sol', 1, '["Call customers"]'), (:'sol', 2, '["Call customers","Send WhatsApp offer"]');
select id as v1 from public.solution_versions where solution_id = :'sol' and version = 1 \gset
select id as v2 from public.solution_versions where solution_id = :'sol' and version = 2 \gset
create function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000b029');
select throws_ok(format($$ select public.create_experiment('fin_test', 'x', 'Loan approvals go faster', 'finance.eligibility', %L, '[]') $$, :'sol'),
  'P0001', 'Financial and legal decisions cannot be experimented on', 'financial decisions are protected');
select throws_ok(format($$ select public.create_experiment('bad_weights', 'x', 'Weights must add up', 'solution_variant', %L,
  jsonb_build_array(jsonb_build_object('key','control','weight',50,'solution_version_id',%L), jsonb_build_object('key','treatment','weight',40,'solution_version_id',%L))) $$, :'sol', :'v1', :'v2'),
  '22023', null, 'weights must add up to 100');
select public.create_experiment('whatsapp_step', 'WhatsApp step', 'Adding a WhatsApp offer step improves results', 'solution_variant', :'sol',
  jsonb_build_array(jsonb_build_object('key','control','weight',50,'solution_version_id',:'v1'), jsonb_build_object('key','treatment','weight',50,'solution_version_id',:'v2')),
  'improved_rate', 20, 90) as eid \gset
select public.set_experiment_status(:'eid', 'running');

-- Sticky, deterministic assignment through the product path.
select pg_temp.login('00000000-0000-0000-0000-00000000a029');
select public.create_business('Experiment Shop') as bid \gset
select public.solution_version_for(:'bid', :'sol') as shown \gset
select is(public.solution_version_for(:'bid', :'sol'), :'shown'::uuid, 'assignment is sticky');
select ok(:'shown'::uuid in (:'v1'::uuid, :'v2'::uuid), 'the business sees its arm''s version');

-- A cohort of 80 businesses with plans under their assigned arm (treatment improves more often).
reset role;
insert into public.businesses (id, name, country_code, currency, created_by)
select gen_random_uuid(), 'Cohort ' || g, 'GH', 'GHS', '00000000-0000-0000-0000-00000000a029' from generate_series(1, 80) g;
insert into public.experiment_assignments (experiment_id, business_id, arm)
select e.id, b.id, private.experiment_arm(e, b.id) from public.experiments e, public.businesses b where e.id = :'eid' and b.name like 'Cohort %';
select ok((select count(distinct arm) = 2 and min(n) >= 25 from (select arm, count(*) n from public.experiment_assignments where experiment_id = :'eid' group by arm) x),
  'hash assignment splits the cohort roughly by weight');
insert into public.interventions (business_id, solution_version_id, title, target_metric, expected_direction, baseline_value, window_days, status, due_at, completed_at, created_by, created_by_role)
select a.business_id, case a.arm when 'control' then :'v1'::uuid else :'v2'::uuid end, 'Push', 'sales_30', 'up', 100, 14, 'completed', now(), now(),
  '00000000-0000-0000-0000-00000000a029', 'owner'
from public.experiment_assignments a where a.experiment_id = :'eid';
insert into public.outcomes (intervention_id, business_id, metric, baseline_value, observed_value, delta, improved, window_start, window_end, status)
select i.id, i.business_id, 'sales_30', 100, 120, 20,
  case when a.arm = 'treatment' then (row_number() over (partition by a.arm order by i.id)) % 5 <> 0      -- 80%
       else (row_number() over (partition by a.arm order by i.id)) % 10 < 3 end,                         -- 30%
  now() - interval '14 days', now(), 'observed'
from public.interventions i join public.experiment_assignments a on a.business_id = i.business_id and a.experiment_id = :'eid';

set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000b029');
select is((public.experiment_report(:'eid') -> 'current' ->> 'decision'), 'treatment_better', 'a real difference is detected');
select ok((public.experiment_report(:'eid') -> 'current' -> 'ci95' ->> 0)::numeric > 0, 'with a 95% interval above zero');
select ok((public.experiment_report(:'eid') -> 'current' ->> 'p_value')::numeric < 0.01, 'and a small p-value');
select is(public.evaluate_experiments(), 1, 'evaluation runs');
select is((select status from public.experiments where id = :'eid'), 'concluded', 'termination criteria conclude the experiment');
select is(jsonb_array_length(public.experiment_report(:'eid') -> 'history'), 1, 'results are kept as history');

-- Guardrails stop a harmful treatment.
select public.create_experiment('guarded', 'Guarded', 'A harder plan might still help', 'solution_variant', :'sol',
  jsonb_build_array(jsonb_build_object('key','control','weight',50,'solution_version_id',:'v1'), jsonb_build_object('key','treatment','weight',50,'solution_version_id',:'v2')),
  'improved_rate', 20, 90, '[{"metric":"abandon_rate","max":0.2}]') as g \gset
select public.set_experiment_status(:'g', 'running');
reset role;
insert into public.experiment_assignments (experiment_id, business_id, arm)
select :'g', business_id, arm from public.experiment_assignments where experiment_id = :'eid';
update public.experiments set started_at = now() - interval '1 minute' where id = :'g';
update public.interventions i set status = 'abandoned', started_at = now()
from public.experiment_assignments a where a.experiment_id = :'g' and a.business_id = i.business_id and a.arm = 'treatment';
update public.interventions i set started_at = now()
from public.experiment_assignments a where a.experiment_id = :'g' and a.business_id = i.business_id and a.arm = 'control';
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000b029');
select public.evaluate_experiments();
select is((select status from public.experiments where id = :'g'), 'stopped', 'a breached guardrail stops the experiment');
select ok((select conclusion like 'Stopped automatically: guardrail breached%' from public.experiments where id = :'g'), 'with the reason recorded');

select * from finish();
rollback;
