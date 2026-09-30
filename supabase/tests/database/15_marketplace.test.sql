begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000a015', 'prov@mk.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000b015', 'admin@mk.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000c015', 'owner@mk.test', 'authenticated', 'authenticated');
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-00000000b015');
create function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000a015');
select public.register_provider('Ledger Coaches', 'trainer', 'hello@ledger.test') as prov \gset
select throws_ok(format($$ select public.submit_solution(%L, 'coach_books', 'Bookkeeping coaching', 'Weekly coaching', 'active_days_30', 'record_keeping', 30, '[]', 'provider_led', 'fixed', 500000, 'NGN') $$, :'prov'),
  '42501', null, 'pending providers cannot submit');

select pg_temp.login('00000000-0000-0000-0000-00000000b015');
select public.review_provider(:'prov', 'approved');
select pg_temp.login('00000000-0000-0000-0000-00000000a015');
select public.submit_solution(:'prov', 'coach_books', 'Bookkeeping coaching', 'Weekly coaching', 'active_days_30', 'record_keeping',
  30, '["Week 1 visit"]', 'provider_led', 'fixed', 500000, 'NGN') as sid \gset
select v.id as vid from public.solution_versions v where v.solution_id = :'sid' \gset

select pg_temp.login('00000000-0000-0000-0000-00000000c015');
select public.create_business('Client Shop') as bid \gset
select is((select count(*)::int from public.solutions where id = :'sid'), 0, 'submitted solutions are not on the marketplace');
select throws_ok(format($$ select public.start_provider_solution(%L, %L, true) $$, :'bid', :'vid'), 'P0001', null, 'unapproved solutions cannot be started');
select throws_ok(format($$ select public.review_solution(%L, 'active') $$, :'sid'), '42501', null, 'only platform admins approve');

select pg_temp.login('00000000-0000-0000-0000-00000000b015');
select public.review_solution(:'sid', 'active', 'Clear playbook, fair price');
select pg_temp.login('00000000-0000-0000-0000-00000000c015');
select is((select price_minor from public.solutions where id = :'sid'), 500000::bigint, 'live solutions carry pricing');
select throws_ok(format($$ select public.start_provider_solution(%L, %L, false) $$, :'bid', :'vid'), 'P0001', null, 'provider-led solutions need consent');
select public.start_provider_solution(:'bid', :'vid', true) as iid \gset
select is((select count(*)::int from public.solution_engagements where intervention_id = :'iid'), 1, 'consent creates an engagement');

select pg_temp.login('00000000-0000-0000-0000-00000000a015');
select is((select count(*)::int from public.provider_engagements(:'prov')), 1, 'provider sees its engagement');
select is((select count(*)::int from public.sales where business_id = :'bid'), 0, 'provider cannot read the books');
select engagement_id as eid from public.provider_engagements(:'prov') \gset
select lives_ok(format($$ select public.post_engagement_update(%L, 'Visited, set up daily recording') $$, :'eid'), 'provider posts progress');

select pg_temp.login('00000000-0000-0000-0000-00000000c015');
select is((select count(*)::int from public.engagement_updates), 1, 'business sees provider updates');
select is((select activated from public.solution_effectiveness(:'sid')), 1, 'provider solutions are measured like any other');

select * from finish();
rollback;
