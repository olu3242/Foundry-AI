begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000f1', 'owner@pp.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000f2', 'staff@pp.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000f3', 'partner@pp.test', 'authenticated', 'authenticated');
create function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-0000000000f1');
select public.create_business('Proof Ltd', null, 'NG', 'NGN') as bid \gset
select public.add_member(:'bid', 'staff@pp.test', 'staff');
select public.add_member(:'bid', 'partner@pp.test', 'partner');
select public.record_entry(:'bid', 'sale', '{"payment_method":"transfer","total_minor":50000}') as sale_id \gset

-- Photo captures confirm as document-backed.
insert into public.captures (business_id, channel, storage_path) values (:'bid', 'photo', :'bid' || '/r.jpg') returning id as cap \gset
reset role; set local role service_role;
insert into public.record_drafts (business_id, capture_id, kind, fields, confidence)
values (:'bid', :'cap', 'expense', '{"category":"Stock / inventory","amount_minor":20000,"payment_method":"cash"}', 0.9) returning id as d \gset
set local role authenticated;
select public.confirm_draft(:'d');
select is((select provenance::text from public.expenses where source_draft_id = :'d'), 'document_backed', 'receipt photos make records document-backed');

select throws_ok(format($$ select public.add_verification(%L, 'sale', 'third_party_verified', 'site_visit', %L) $$, :'bid', :'sale_id'),
  '42501', null, 'owners cannot vouch for themselves as a third party');
select lives_ok(format($$ select public.add_verification(%L, 'sale', 'document_backed', 'invoice', %L) $$, :'bid', :'sale_id'), 'owner attaches an invoice');
select is((select provenance::text from public.sales where id = :'sale_id'), 'document_backed', 'sale provenance rises');

select pg_temp.login('00000000-0000-0000-0000-0000000000f3');
select lives_ok(format($$ select public.add_verification(%L, 'business', 'third_party_verified', 'site_visit', p_note => 'Visited the shop') $$, :'bid'),
  'partner verifies after a visit');
select throws_ok(format($$ select public.add_verification(%L, 'business', 'institution_verified', 'program_review') $$, :'bid'),
  '42501', null, 'partners cannot institution-verify');
select throws_ok(format($$ insert into public.passport_shares (business_id, token_hash, label, sections, expires_at) values (%L, 'x', 'Bank', '{summary}', now() + interval '1 day') $$, :'bid'),
  '42501', null, 'partners cannot share a business passport');

select pg_temp.login('00000000-0000-0000-0000-0000000000f2');
select is((select count(*)::int from public.passport_shares), 0, 'staff cannot see share links');

select pg_temp.login('00000000-0000-0000-0000-0000000000f1');
insert into public.passport_shares (business_id, token_hash, label, sections, expires_at)
values (:'bid', 'hash-1', 'Loan officer', '{summary,proof}', now() + interval '30 days') returning id as share \gset
select throws_ok(format($$ update public.passport_shares set sections = '{summary,track_record,proof,pulse}' where id = %L $$, :'share'),
  '42501', null, 'share scope is immutable');
select lives_ok(format($$ update public.passport_shares set revoked_at = now() where id = %L $$, :'share'), 'owner revokes a share');
select is((select count(*)::int from public.events where type in ('passport.shared', 'passport.revoked')), 2, 'sharing and revoking are logged');

reset role; set local role service_role;
select is((public.passport_facts(:'bid') ->> 'highest_level'), 'third_party_verified', 'passport shows the highest verification level');

select * from finish();
rollback;
