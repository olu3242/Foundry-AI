begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000a016', 'owner@learn.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000b016', 'admin@learn.test', 'authenticated', 'authenticated');
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-00000000b016');
create function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000a016');
select public.create_business('Learn Shop') as bid \gset
insert into public.captures (business_id, channel, raw_text) values (:'bid', 'text', 'sold rice') returning id as cap \gset

reset role; set local role service_role;
insert into public.agent_actions (business_id, action_type, autonomy_level, title, generator) values
  (:'bid', 'growth.recommend', 1, 'A', 'rules-v2'), (:'bid', 'growth.recommend', 1, 'B', 'rules-v2'),
  (:'bid', 'growth.recommend', 1, 'C', 'rules-v2');
select id as a1 from public.agent_actions where title = 'A' \gset
select id as a2 from public.agent_actions where title = 'B' \gset
insert into public.record_drafts (business_id, capture_id, kind, fields, confidence) values
  (:'bid', :'cap', 'expense', '{"category":"Rent","amount_minor":100,"payment_method":"cash"}', 0.9),
  (:'bid', :'cap', 'expense', '{"category":"Food","amount_minor":50,"payment_method":"cash"}', 0.9);
select id as d1 from public.record_drafts where fields ->> 'category' = 'Rent' \gset
select id as d2 from public.record_drafts where fields ->> 'category' = 'Food' \gset
select ok((select ai_fields = fields from public.record_drafts where id = :'d1'), 'AI proposal is preserved');

set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000a016');
select public.start_intervention(:'bid', 'Plan A', 'sales_30', 7, :'a1') as i1 \gset
select public.complete_intervention(:'i1');
select public.decide_action(:'a2', 'rejected');
select public.confirm_draft(:'d1');
select public.confirm_draft(:'d2', '{"category":"Transport","amount_minor":50,"payment_method":"cash"}');
select public.give_pulse_feedback(:'bid', 'sales_momentum', current_date, 'inaccurate');
select throws_ok($$ select public.learning_overview() $$, '42501', null, 'learning data is platform-admin only');

reset role; set local role service_role;
insert into public.outcomes (intervention_id, business_id, metric, baseline_value, observed_value, delta, improved, window_start, window_end, status)
values (:'i1', :'bid', 'sales_30', 0, 10, 10, true, now(), now(), 'verified');
select results_eq($$ select shown, accepted, rejected, pending from public.recommendation_eval() where generator = 'rules-v2' $$,
  $$ values (3, 1, 1, 1) $$, 'recommendations are tracked from shown to decision');
select is((select verified_rate from public.recommendation_eval() where generator = 'rules-v2'), 1.000, 'accepted recommendations are followed to verified outcomes');
select is((select acceptance_rate from public.recommendation_eval() where generator = 'rules-v2'), 0.500, 'acceptance excludes still-pending items');
select results_eq($$ select confirmed, edited from public.extraction_eval() $$, $$ values (2, 1) $$, 'edits at confirmation count against extraction');
select is((select accuracy from public.pulse_calibration() where dimension = 'sales_momentum'), 0.000, 'Pulse calibration from owner feedback');
select ok(public.take_eval_snapshot() >= 3, 'daily evaluation snapshot');

set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000b016');
select ok(jsonb_array_length(public.learning_overview() -> 'recommendations') >= 1, 'admins see the learning overview');

select * from finish();
rollback;
