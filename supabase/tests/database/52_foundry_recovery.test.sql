begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users(id,email,aud,role) values ('00000000-0000-0000-0000-00000000f081','recovery@test.dev','authenticated','authenticated');
insert into public.profiles(id,display_name) values ('00000000-0000-0000-0000-00000000f081','Recovery Admin');
insert into public.platform_admins(user_id) values ('00000000-0000-0000-0000-00000000f081');
insert into public.businesses(id,name,country_code,currency,created_by) values ('00000000-0000-0000-0000-00000000f082','Recovery Biz','GH','GHS','00000000-0000-0000-0000-00000000f081');

select public.enqueue_job('system.ping','00000000-0000-0000-0000-00000000f082',
'{"_foundry_flow":{"flow_id":"00000000-0000-0000-0000-00000000f083","flow_type":"system.recovery_test","stage":"ready","correlation_id":"00000000-0000-0000-0000-00000000f084","authority_mode":"auto","approval_required":false,"evidence_required":false,"triggered_by":"test","created_at":"2026-10-02T12:00:00Z","metadata":{}}}',
'recovery-test',now(),1) as job \gset;
select * from public.claim_jobs('recovery-test',1,null,:'job'::uuid);
select public.fail_job(:'job'::uuid,'terminal',false);

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-00000000f081',true);
select set_config('request.jwt.claim.role','authenticated',true);

select is((select stage from public.foundry_flows where id='00000000-0000-0000-0000-00000000f083'),'failed','terminal pair starts failed');
select lives_ok($$ select public.replay_foundry_flow('00000000-0000-0000-0000-00000000f083','operator confirmed safe replay') $$,'admin can replay a failed flow');
select is((select stage from public.foundry_flows where id='00000000-0000-0000-0000-00000000f083'),'ready','replay restores flow to ready');
select is((select status::text from public.jobs where id=:'job'::uuid),'queued','replay restores linked job to queue');
select is((select attempts from public.jobs where id=:'job'::uuid),0,'replay resets attempts');
select throws_ok($$ select public.replay_foundry_flow('00000000-0000-0000-0000-00000000f083','repeat replay') $$,'P0002','Only failed flows with a linked job can be replayed','ready flow cannot be replayed again');

select * from finish();
rollback;
