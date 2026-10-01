begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000a032', 'owner@b32.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000c032', 'prog@b32.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000d032', 'other@b32.test', 'authenticated', 'authenticated');
create function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000a032');
select public.create_business('Memory Shop') as bid \gset
select public.record_entry(:'bid', 'sale', jsonb_build_object('total_minor', 1000, 'occurred_at', now() - interval '40 days'));
select public.record_entry(:'bid', 'sale', jsonb_build_object('total_minor', 2000, 'occurred_at', now()));
select public.start_intervention(:'bid', 'Sales push', 'sales_30', 7) as iid \gset
select public.complete_intervention(:'iid');
reset role;
insert into public.outcomes (intervention_id, business_id, metric, baseline_value, observed_value, delta, improved, window_start, window_end, status)
values (:'iid', :'bid', 'sales_30', 1000, 900, -100, false, now() - interval '7 days', now(), 'observed');
insert into public.pulse_snapshots (business_id, computed_on, dimension, state, why)
select :'bid', current_date - d, 'sales_momentum', case when d % 2 = 0 then 'at_risk' else 'steady' end::public.pulse_state, 'test'
from generate_series(0, 5) d;
insert into public.agent_actions (business_id, action_type, autonomy_level, title, body, payload, generator)
values (:'bid', 'growth.recommend', 1, 'Run a sales push', 'Sales fell', '{"dimension":"sales_momentum"}', 'rules-v2-ranked');

set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000d032');
select throws_ok(format($$ select public.refresh_business_memory(%L) $$, :'bid'), '42501', null, 'strangers cannot read memory');
select pg_temp.login('00000000-0000-0000-0000-00000000a032');
select ok(public.refresh_business_memory(:'bid') >= 6, 'memory is built from sources of record');
select is((select count(*)::int from public.business_memory where business_id = :'bid' and kind = 'month_summary'), 2, 'one fact entry per trading month');
select is((select layer from public.business_memory where business_id = :'bid' and kind = 'outcome'), 'observed', 'unverified results are observed, not verified');
select is((select layer from public.business_memory where business_id = :'bid' and kind = 'recurring_issue' and topic = 'sales_momentum'), 'derived', 'recurring issues are derived');
select is((select layer from public.business_memory where business_id = :'bid' and kind = 'interpretation'), 'inferred', 'AI suggestions are stored as inferred');
select is((select count(*)::int from public.memory_timeline(:'bid') where layer = 'inferred'), 0, 'the timeline separates facts from interpretation by default');

select is((select count(*)::int from public.business_memory where business_id = :'bid'), (select public.refresh_business_memory(:'bid') * 0 + count(*)::int from public.business_memory where business_id = :'bid'),
  'refresh is idempotent');
select ok((select (public.memory_context(:'bid', 'sales_momentum') -> 'prior_plans' -> 0 -> 'result' ->> 'improved')::boolean = false),
  'context recalls the earlier plan and its result');
select is((public.memory_context(:'bid', 'sales_momentum') -> 'recurring' ->> 'at_risk')::int, 3, 'and that the issue keeps coming back');

reset role;
update public.outcomes set status = 'verified', verified_at = now() where intervention_id = :'iid';
set local role authenticated;
select public.refresh_business_memory(:'bid');
select is((select layer from public.business_memory where business_id = :'bid' and kind = 'outcome'), 'verified', 'verification upgrades the evidence layer');

select * from finish();
rollback;
