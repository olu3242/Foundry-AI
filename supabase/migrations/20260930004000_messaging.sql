-- B42 Communication rails: EVENT → COMMUNICATION POLICY → MESSAGE → DELIVERY → RECEIPT/FAILURE → AUDIT.
-- Vendor-neutral: workflows queue *messages*; adapters (WhatsApp Cloud API, Africa's Talking SMS)
-- deliver them. Consent per phone and channel, quiet hours in the business's timezone, rate
-- control, versioned templates, delivery receipts and inbound STOP. Reuses B22/B23 (what to say),
-- B4 events/jobs, B30 incidents, B41 settings.

create table public.message_templates (
  id                uuid primary key default gen_random_uuid(),
  key               text not null,
  channel           text not null check (channel in ('whatsapp', 'sms')),
  locale            text not null default 'en',
  version           int not null default 1,
  body              text not null check (char_length(body) <= 1024),     -- rendered text; {{name}} placeholders
  params            text[] not null default '{}',                         -- ordered variables (WhatsApp template parameters)
  provider_template text,                                                 -- approved WhatsApp template name
  status            text not null default 'active' check (status in ('active', 'retired')),
  created_at        timestamptz not null default now(),
  unique (key, channel, locale, version)
);

insert into public.message_templates (key, channel, locale, body, params, provider_template) values
  ('record_request', 'whatsapp', 'en', 'Hello from Foundry. Nothing has been recorded for {{business_name}} since {{last_record}}. Reply with what you sold and spent, or open Foundry. Reply STOP to stop messages.', array['business_name', 'last_record'], 'foundry_record_request'),
  ('record_request', 'sms', 'en', 'Foundry: nothing recorded for {{business_name}} since {{last_record}}. Open Foundry to catch up. Reply STOP to stop.', array['business_name', 'last_record'], null),
  ('record_request', 'whatsapp', 'fr', 'Bonjour de Foundry. Rien n''a été enregistré pour {{business_name}} depuis le {{last_record}}. Ouvrez Foundry pour rattraper. Répondez STOP pour arrêter.', array['business_name', 'last_record'], 'foundry_record_request'),
  ('record_request', 'sms', 'fr', 'Foundry : rien enregistré pour {{business_name}} depuis le {{last_record}}. Ouvrez Foundry. STOP pour arrêter.', array['business_name', 'last_record'], null),
  ('plan_reminder', 'whatsapp', 'en', 'Foundry: your plan "{{plan}}" ends {{due}}. Mark it done in Foundry so we can measure the result. Reply STOP to stop messages.', array['plan', 'due'], 'foundry_plan_reminder'),
  ('plan_reminder', 'sms', 'en', 'Foundry: your plan "{{plan}}" ends {{due}}. Mark it done in Foundry to measure the result. STOP to stop.', array['plan', 'due'], null),
  ('payment_request', 'whatsapp', 'en', 'Foundry: {{description}} — {{amount}} is due. Pay securely here: {{link}}. Reply STOP to stop messages.', array['description', 'amount', 'link'], 'foundry_payment_request'),
  ('payment_request', 'sms', 'en', 'Foundry: {{description}} {{amount}} due. Pay: {{link}} STOP to stop.', array['description', 'amount', 'link'], null);

create table public.communication_consents (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses (id) on delete cascade,
  phone        text not null check (phone ~ '^[0-9]{8,15}$'),
  channel      text not null check (channel in ('whatsapp', 'sms')),
  status       text not null check (status in ('opted_in', 'opted_out')),
  source       text not null check (source in ('owner_settings', 'inbound_stop', 'operator_recorded')),
  recorded_by  uuid references public.profiles (id),
  updated_at   timestamptz not null default now(),
  unique (business_id, phone, channel)
);
create index communication_consents_phone_idx on public.communication_consents (phone);
create trigger communication_consents_audit after insert or update on public.communication_consents for each row execute function private.audit_row();

create table public.messages (
  id                   uuid primary key default gen_random_uuid(),
  business_id          uuid not null references public.businesses (id) on delete cascade,
  phone                text,
  channel              text check (channel in ('whatsapp', 'sms')),
  template_id          uuid references public.message_templates (id),
  variables            jsonb not null default '{}',
  body                 text,
  source_type          text not null,
  source_id            text,
  correlation_id       text not null unique,
  status               text not null default 'queued' check (status in ('queued', 'sending', 'sent', 'delivered', 'read', 'failed', 'suppressed')),
  suppression_reason   text,
  provider             text,
  provider_message_id  text unique,
  attempts             int not null default 0,
  last_error           text,
  send_after           timestamptz not null default now(),
  created_at           timestamptz not null default now(),
  sent_at              timestamptz,
  delivered_at         timestamptz
);
create index messages_business_idx on public.messages (business_id, created_at desc);
create index messages_status_idx on public.messages (status, send_after);

create table public.message_events (
  id                 bigint generated always as identity primary key,
  message_id         uuid references public.messages (id) on delete cascade,
  business_id        uuid references public.businesses (id) on delete cascade,
  provider           text not null,
  kind               text not null check (kind in ('status', 'inbound')),
  status             text,
  provider_event_id  text unique,
  detail             jsonb not null default '{}',
  occurred_at        timestamptz not null default now()
);
create index message_events_message_idx on public.message_events (message_id);
create index message_events_business_idx on public.message_events (business_id);

insert into public.platform_settings (key, value) values
  ('messaging', '{"quiet_start": 20, "quiet_end": 7, "max_per_business_per_day": 3}')
on conflict (key) do nothing;

-- ─── Communication policy ─────────────────────────────────────────────────────
-- Owner phone(s) of a business (auth phones, digits only).
create function private.business_owner_phone(bid uuid) returns text
language sql stable security definer set search_path = '' as $$
  select p.phone from public.memberships m join public.profiles p on p.id = m.user_id
  where m.business_id = bid and m.role = 'owner' and p.phone is not null order by m.created_at limit 1;
$$;

-- Next allowed send time given quiet hours in the business's local time.
create function private.after_quiet_hours(bid uuid, t timestamptz) returns timestamptz
language plpgsql stable security definer set search_path = '' as $$
declare
  tz text := coalesce((select timezone from public.businesses where id = bid), 'UTC');
  cfg jsonb := coalesce((select value from public.platform_settings where key = 'messaging'), '{}');
  qs int := coalesce((cfg ->> 'quiet_start')::int, 20);
  qe int := coalesce((cfg ->> 'quiet_end')::int, 7);
  local_ts timestamp := t at time zone tz;
  h int := extract(hour from local_ts);
begin
  if qs = qe then
    return t;                                            -- quiet hours disabled
  end if;
  if (qs > qe and (h >= qs or h < qe)) or (qs < qe and h >= qs and h < qe) then
    return ((date_trunc('day', local_ts) + case when h >= qs and qs > qe then interval '1 day' else interval '0' end
             + make_interval(hours => qe)) at time zone tz);
  end if;
  return t;
end $$;

-- Queue a message for a business: consent → channel → rate control → quiet hours → render.
-- Always records the decision (suppressed messages are kept with their reason).
create function private.queue_message(bid uuid, template_key text, vars jsonb, src_type text, src_id text, correlation text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  phone_ text := private.business_owner_phone(bid);
  loc text := coalesce((select locale from public.businesses where id = bid), 'en');
  ch text;
  tpl public.message_templates;
  body_ text;
  k text;
  sent_today int;
  cfg jsonb := coalesce((select value from public.platform_settings where key = 'messaging'), '{}');
  mid uuid;
  reason text;
begin
  if exists (select 1 from public.messages where correlation_id = correlation) then
    return (select id from public.messages where correlation_id = correlation);
  end if;
  select c.channel into ch from public.communication_consents c
  where c.business_id = bid and c.phone = phone_ and c.status = 'opted_in'
  order by case c.channel when 'whatsapp' then 1 else 2 end limit 1;
  if phone_ is null then
    reason := 'no_phone';
  elsif ch is null then
    reason := 'no_consent';
  end if;
  if reason is null then
    select * into tpl from public.message_templates t
    where t.key = template_key and t.channel = ch and t.status = 'active' and t.locale in (loc, 'en')
    order by (t.locale = loc) desc, t.version desc limit 1;
    if tpl.id is null then
      reason := 'no_template';
    end if;
  end if;
  if reason is null then
    select count(*) into sent_today from public.messages
    where business_id = bid and status not in ('suppressed', 'failed') and created_at > now() - interval '24 hours';
    if sent_today >= coalesce((cfg ->> 'max_per_business_per_day')::int, 3) then
      reason := 'rate_limited';
    end if;
  end if;
  if reason is null then
    body_ := tpl.body;
    for k in select jsonb_object_keys(vars) loop
      body_ := replace(body_, '{{' || k || '}}', coalesce(vars ->> k, ''));
    end loop;
    if body_ ~ '\{\{[a-z_]+\}\}' then
      reason := 'missing_variables';
    end if;
  end if;
  insert into public.messages (business_id, phone, channel, template_id, variables, body, source_type, source_id, correlation_id, status, suppression_reason, send_after)
  values (bid, phone_, ch, tpl.id, vars, body_, src_type, src_id, correlation,
          case when reason is null then 'queued' else 'suppressed' end, reason,
          case when reason is null then private.after_quiet_hours(bid, now()) else now() end)
  returning id into mid;
  if reason is null then
    perform private.enqueue_job('message.send', bid, jsonb_build_object('message_id', mid), 'msg:' || mid);
    update public.jobs set run_at = (select send_after from public.messages where id = mid) where dedupe_key = 'msg:' || mid and status = 'queued';
  end if;
  perform private.emit_event(bid, 'message.' || case when reason is null then 'queued' else 'suppressed' end, 'message', mid,
    jsonb_build_object('template', template_key, 'channel', ch, 'reason', reason));
  return mid;
end $$;

-- B23 routine automation that executes for the owner also reaches them outside the app.
create function private.message_on_ops_action() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  last_rec timestamptz;
begin
  if new.source <> 'ops-automation' or new.status <> 'executed' then
    return new;
  end if;
  if new.action_type = 'ops.record_request' then
    last_rec := (new.payload -> 'evidence' ->> 'last_record_at')::timestamptz;
    perform private.queue_message(new.business_id, 'record_request',
      jsonb_build_object('business_name', (select name from public.businesses where id = new.business_id),
                         'last_record', coalesce(to_char(last_rec, 'DD Mon'), 'a while')),
      'agent_action', new.id::text, 'ops:' || new.id);
  elsif new.action_type = 'ops.plan_reminder' then
    perform private.queue_message(new.business_id, 'plan_reminder',
      jsonb_build_object('plan', (select title from public.interventions where id = (new.payload -> 'evidence' ->> 'intervention_id')::uuid),
                         'due', to_char((new.payload -> 'evidence' ->> 'due_at')::timestamptz, 'DD Mon')),
      'agent_action', new.id::text, 'ops:' || new.id);
  end if;
  return new;
end $$;
create trigger agent_actions_messaging after insert on public.agent_actions for each row execute function private.message_on_ops_action();

-- ─── Owner consent ────────────────────────────────────────────────────────────
create function public.set_message_consent(p_business_id uuid, p_channel text, p_opt_in boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  phone_ text := private.business_owner_phone(p_business_id);
begin
  if not private.has_role(p_business_id, array['owner']::public.business_role[]) then
    raise exception 'Only the owner can choose how Foundry contacts them' using errcode = '42501';
  end if;
  if phone_ is null then
    raise exception 'Add a phone number to your account first' using errcode = 'P0001';
  end if;
  insert into public.communication_consents (business_id, phone, channel, status, source, recorded_by)
  values (p_business_id, phone_, p_channel, case when p_opt_in then 'opted_in' else 'opted_out' end, 'owner_settings', auth.uid())
  on conflict (business_id, phone, channel) do update set status = excluded.status, source = excluded.source, recorded_by = excluded.recorded_by, updated_at = now();
end $$;

-- ─── Worker + webhooks (service role) ─────────────────────────────────────────
create function public.message_for_send(p_message_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', m.id, 'status', m.status, 'phone', m.phone, 'channel', m.channel, 'body', m.body, 'attempts', m.attempts,
    'send_after', m.send_after, 'business_id', m.business_id,
    'consented', exists (select 1 from public.communication_consents c where c.business_id = m.business_id and c.phone = m.phone and c.channel = m.channel and c.status = 'opted_in'),
    'template', jsonb_build_object('name', t.provider_template, 'locale', t.locale,
      'params', (select coalesce(jsonb_agg(m.variables ->> p order by i), '[]') from unnest(t.params) with ordinality u(p, i))))
  from public.messages m left join public.message_templates t on t.id = m.template_id where m.id = p_message_id;
$$;

create function public.record_message_send(p_message_id uuid, p_provider text, p_provider_message_id text, p_error text, p_final boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  m public.messages;
begin
  update public.messages set attempts = attempts + 1, provider = p_provider,
    provider_message_id = coalesce(nullif(p_provider_message_id, ''), provider_message_id),
    status = case when nullif(p_provider_message_id, '') is not null then 'sent' when p_final then 'failed' else 'queued' end,
    sent_at = case when nullif(p_provider_message_id, '') is not null then now() else sent_at end,
    last_error = nullif(p_error, '')
  where id = p_message_id returning * into m;
  if m.status in ('sent', 'failed') then
    perform private.emit_event(m.business_id, 'message.' || m.status, 'message', m.id, jsonb_build_object('provider', p_provider, 'channel', m.channel, 'error', nullif(p_error, '')));
  end if;
end $$;

create function public.suppress_message(p_message_id uuid, p_reason text) returns void
language sql security definer set search_path = '' as $$
  update public.messages set status = 'suppressed', suppression_reason = p_reason where id = p_message_id and status in ('queued', 'sending');
$$;

-- Delivery receipts: idempotent per provider event; statuses only move forward.
create function public.record_message_receipt(p_provider text, p_provider_message_id text, p_status text, p_event_id text, p_detail jsonb) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  m public.messages;
  rank_new int := array_position(array['sent', 'delivered', 'read'], p_status);
begin
  select * into m from public.messages where provider = p_provider and provider_message_id = p_provider_message_id;
  if not found then
    return false;
  end if;
  insert into public.message_events (message_id, business_id, provider, kind, status, provider_event_id, detail)
  values (m.id, m.business_id, p_provider, 'status', p_status, p_event_id, coalesce(p_detail, '{}'))
  on conflict (provider_event_id) do nothing;
  if not found then
    return true;                                         -- duplicate receipt
  end if;
  if p_status = 'failed' then
    update public.messages set status = 'failed', last_error = coalesce(p_detail ->> 'error', 'provider reported failure') where id = m.id and status <> 'read';
  elsif rank_new is not null and rank_new > coalesce(array_position(array['sent', 'delivered', 'read'], m.status), 0) then
    update public.messages set status = p_status, delivered_at = case when p_status in ('delivered', 'read') then coalesce(delivered_at, now()) end where id = m.id;
  end if;
  perform private.emit_event(m.business_id, 'message.' || p_status, 'message', m.id, jsonb_build_object('provider', p_provider));
  return true;
end $$;

-- Inbound: STOP opts the phone out of every channel; anything else is logged for the operator.
create function public.record_inbound_message(p_provider text, p_from text, p_text text, p_event_id text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  phone_ text := regexp_replace(p_from, '[^0-9]', '', 'g');
  stop boolean := upper(trim(coalesce(p_text, ''))) in ('STOP', 'UNSUBSCRIBE', 'ARRET', 'ARRÊT', 'STOPALL', 'CANCEL');
  b record;
begin
  for b in select distinct business_id from public.communication_consents where phone = phone_ loop
    insert into public.message_events (business_id, provider, kind, status, provider_event_id, detail)
    values (b.business_id, p_provider, 'inbound', case when stop then 'opt_out' else 'received' end, p_event_id, jsonb_build_object('text', left(p_text, 500)))
    on conflict (provider_event_id) do nothing;
    if stop then
      update public.communication_consents set status = 'opted_out', source = 'inbound_stop', updated_at = now() where business_id = b.business_id and phone = phone_;
      perform private.emit_event(b.business_id, 'message.opted_out', 'business', b.business_id, jsonb_build_object('provider', p_provider));
    end if;
  end loop;
  return case when stop then 'opted_out' else 'logged' end;
end $$;

create function public.messaging_overview(p_days int default 30) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_platform_admin() then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'by_status', (select coalesce(jsonb_object_agg(status, n), '{}') from (select status, count(*) n from public.messages where created_at > now() - make_interval(days => p_days) group by 1) x),
    'suppressed', (select coalesce(jsonb_object_agg(suppression_reason, n), '{}') from (select suppression_reason, count(*) n from public.messages
                   where status = 'suppressed' and created_at > now() - make_interval(days => p_days) group by 1) x),
    'by_channel', (select coalesce(jsonb_agg(x), '[]') from (select channel, count(*) n, count(*) filter (where status in ('delivered', 'read')) delivered,
                   count(*) filter (where status = 'failed') failed from public.messages where channel is not null and created_at > now() - make_interval(days => p_days) group by 1) x),
    'consents', (select coalesce(jsonb_object_agg(channel || ':' || status, n), '{}') from (select channel, status, count(*) n from public.communication_consents group by 1, 2) x),
    'recent', (select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'business', b.name, 'channel', m.channel, 'status', m.status, 'reason', m.suppression_reason,
                 'error', m.last_error, 'provider', m.provider, 'at', m.created_at) order by m.created_at desc), '[]')
               from (select * from public.messages order by created_at desc limit 30) m join public.businesses b on b.id = m.business_id));
end $$;

revoke execute on function public.set_message_consent(uuid, text, boolean), public.messaging_overview(int) from public, anon;
grant execute on function public.set_message_consent(uuid, text, boolean), public.messaging_overview(int) to authenticated;
revoke execute on function public.message_for_send(uuid), public.record_message_send(uuid, text, text, text, boolean), public.suppress_message(uuid, text),
  public.record_message_receipt(text, text, text, text, jsonb), public.record_inbound_message(text, text, text, text) from public, anon, authenticated;
grant execute on function public.message_for_send(uuid), public.record_message_send(uuid, text, text, text, boolean), public.suppress_message(uuid, text),
  public.record_message_receipt(text, text, text, text, jsonb), public.record_inbound_message(text, text, text, text) to service_role;

alter table public.message_templates enable row level security;
alter table public.communication_consents enable row level security;
alter table public.messages enable row level security;
alter table public.message_events enable row level security;
create policy "templates: admins" on public.message_templates for select to authenticated using (private.is_platform_admin());
create policy "consents: readers" on public.communication_consents for select to authenticated using (private.can_read(business_id) or private.is_platform_admin());
create policy "messages: readers" on public.messages for select to authenticated using (private.can_read(business_id) or private.is_platform_admin());
create policy "message events: readers" on public.message_events for select to authenticated using ((business_id is not null and private.can_read(business_id)) or private.is_platform_admin());
revoke insert, update, delete on public.message_templates, public.communication_consents, public.messages, public.message_events from authenticated;
