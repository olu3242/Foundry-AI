begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id,email,aud,role) values ('00000000-0000-0000-0000-00000000f071','runtime@test.dev','authenticated','authenticated');
insert into public.profiles (id,display_name) values ('00000000-0000-0000-0000-00000000f071','Runtime Owner');
insert into public.businesses (id,name,country_code,currency,created_by) values ('00000000-0000-0000-0000-00000000f072','Runtime Flow','GH','GHS','00000000-0000-0000-0000-00000000f071');

select public.enqueue_job(
  'pulse.compute','00000000-0000-0000-0000-00000000f072',
  '{"_foundry_flow":{"flow_id":"00000000-0000-0000-0000-00000000f073","flow_type":"business.daily_intelligence","stage":"ready","correlation_id":"00000000-0000-0000-0000-00000000f074","authority_mode":"auto","approval_required":false,"evidence_required":true,"triggered_by":"test","capability":{"kind":"internal.compute"},"created_at":"2026-10-02T12:00:00Z","metadata":{}}}',
  'flow-runtime-success',now(),5
) as job \gset

select is((select job_id from public.foundry_flows where id='00000000-0000-0000-0000-00000000f073'), :'job'::uuid, 'enqueue binds flow to job');
select is((select stage from public.foundry_flows where id='00000000-0000-0000-0000-00000000f073'), 'ready', 'flow begins ready');

select * from public.claim_jobs('flow-test',1,null,:'job'::uuid);
select is((select stage from public.foundry_flows where id='00000000-0000-0000-0000-00000000f073'), 'executing', 'claim advances flow to executing');

select throws_ok($$ select public.complete_job(:'job'::uuid, null) $$,'23514','Foundry flow requires execution evidence before completion','required evidence prevents false completion');
select is((select status::text from public.jobs where id=:'job'::uuid),'running','job remains running when evidence is absent');

select public.complete_job(:'job'::uuid,'{"evidence_id":"ev-1","verified":true}');
select is((select status::text from public.jobs where id=:'job'::uuid),'succeeded','evidenced job succeeds');
select is((select stage from public.foundry_flows where id='00000000-0000-0000-0000-00000000f073'),'completed','evidenced flow completes');

select public.enqueue_job(
  'pulse.compute','00000000-0000-0000-0000-00000000f072',
  '{"_foundry_flow":{"flow_id":"00000000-0000-0000-0000-00000000f075","flow_type":"business.daily_intelligence","stage":"ready","correlation_id":"00000000-0000-0000-0000-00000000f076","authority_mode":"auto","approval_required":false,"evidence_required":false,"triggered_by":"test","created_at":"2026-10-02T12:00:00Z","metadata":{}}}',
  'flow-runtime-fail',now(),1
) as deadjob \gset
select * from public.claim_jobs('flow-test',1,null,:'deadjob'::uuid);
select is((select public.fail_job(:'deadjob'::uuid,'terminal',false))::text,'dead','terminal failure dead-letters job');
select is((select stage from public.foundry_flows where id='00000000-0000-0000-0000-00000000f075'),'failed','terminal failure closes flow');

select * from finish();
rollback;
