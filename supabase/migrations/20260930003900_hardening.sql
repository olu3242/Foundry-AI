-- B41 Production hardening (database side): dual approval for sensitive configuration and
-- job failure/retry visibility. Reuses B19 markets, B28 policies, B31 packs, B37 datasets, B30
-- control plane. Dual approval is ON by default (production); local seed turns it off for dev.

create table public.platform_settings (
  key         text primary key,
  value       jsonb not null,
  updated_by  uuid references public.profiles (id),
  updated_at  timestamptz not null default now()
);
insert into public.platform_settings (key, value) values ('dual_approval', 'true');

create table public.change_requests (
  id            uuid primary key default gen_random_uuid(),
  kind          text not null check (kind in ('policy_activation', 'pack_upsert', 'market_upsert', 'dataset_update', 'setting_update')),
  target        text not null,
  payload       jsonb not null default '{}',
  reason        text not null check (char_length(reason) between 5 and 1000),
  status        text not null default 'pending' check (status in ('pending', 'rejected', 'applied', 'failed')),
  requested_by  uuid not null default auth.uid() references public.profiles (id),
  requested_at  timestamptz not null default now(),
  decided_by    uuid references public.profiles (id),
  decided_at    timestamptz,
  decision_note text,
  error         text,
  constraint change_requests_four_eyes check (decided_by is null or decided_by <> requested_by)
);
create index change_requests_status_idx on public.change_requests (status, requested_at desc);
create trigger change_requests_audit after insert or update on public.change_requests for each row execute function private.audit_row();

create function private.dual_approval_on() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select (value #>> '{}')::boolean from public.platform_settings where key = 'dual_approval'), true);
$$;

-- Sensitive changes run only inside an approved change request when dual approval is on.
create function private.require_second_approval(kind text) returns void
language plpgsql stable set search_path = '' as $$
begin
  if private.dual_approval_on() and coalesce(current_setting('app.applying_change', true), '') <> kind then
    raise exception 'This change needs a second approver: submit it as a change request (%)', kind using errcode = 'P0001';
  end if;
end $$;

create or replace function public.upsert_market(p_market jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_platform_admin() then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
  perform private.require_second_approval('market_upsert');
  insert into public.markets (country_code, name, currency, default_timezone, default_locale, languages, phone_prefix,
                              identifier_types, jurisdiction, connectors, data_residency, status)
  values (upper(p_market ->> 'country_code'), p_market ->> 'name', upper(p_market ->> 'currency'), p_market ->> 'default_timezone',
          coalesce(p_market ->> 'default_locale', 'en'), coalesce(array(select jsonb_array_elements_text(p_market -> 'languages')), array['en']),
          p_market ->> 'phone_prefix', coalesce(p_market -> 'identifier_types', '[]'), coalesce(p_market -> 'jurisdiction', '{}'),
          coalesce(p_market -> 'connectors', '{}'), coalesce(p_market ->> 'data_residency', 'any'), coalesce(p_market ->> 'status', 'beta'))
  on conflict (country_code) do update set name = excluded.name, currency = excluded.currency, default_timezone = excluded.default_timezone,
    default_locale = excluded.default_locale, languages = excluded.languages, phone_prefix = excluded.phone_prefix,
    identifier_types = excluded.identifier_types, jurisdiction = excluded.jurisdiction, connectors = excluded.connectors,
    data_residency = excluded.data_residency, status = excluded.status, updated_at = now();
end $$;

create or replace function public.activate_policy(p_policy_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  p public.policies;
begin
  if not private.is_platform_admin() then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
  perform private.require_second_approval('policy_activation');
  select * into p from public.policies where id = p_policy_id;
  update public.policies set status = 'retired' where key = p.key and scope_type = p.scope_type and scope_id = p.scope_id and status = 'active';
  update public.policies set status = 'active', activated_at = now() where id = p.id;
end $$;

create or replace function public.upsert_pack(p_key text, p_name text, p_definition jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_platform_admin() then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
  perform private.require_second_approval('pack_upsert');
  if not (p_definition ? 'entities' and p_definition ? 'metrics' and p_definition ? 'pulse') then
    raise exception 'A pack needs entities, metrics and pulse rules' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_each(p_definition -> 'metrics') m
             where m.value ->> 'direction' not in ('up', 'down')
                or m.value -> 'numerator' ->> 'source' not in ('sales', 'expenses', 'stock_movements', 'vertical_records')
                or (m.value ->> 'type' = 'ratio' and m.value -> 'denominator' ->> 'source' not in ('sales', 'expenses', 'stock_movements', 'vertical_records'))) then
    raise exception 'Metrics must use a supported source and direction' using errcode = '22023';
  end if;
  insert into public.vertical_packs (key, name, definition) values (p_key, p_name, p_definition)
  on conflict (key) do update set name = excluded.name, definition = excluded.definition, version = public.vertical_packs.version + 1, updated_at = now();
end $$;

-- B37 dataset publication settings, now changeable only through approval.
create function public.update_dataset(p_key text, p_allowed_uses text[], p_min_group_size int) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_platform_admin() then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
  perform private.require_second_approval('dataset_update');
  if p_min_group_size < 5 then
    raise exception 'Groups smaller than 5 are never published' using errcode = '22023';
  end if;
  update public.datasets set allowed_uses = p_allowed_uses, min_group_size = p_min_group_size, version = version + 1 where key = p_key;
  if not found then
    raise exception 'Unknown dataset' using errcode = 'P0002';
  end if;
end $$;

create function public.set_platform_setting(p_key text, p_value jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_platform_admin() then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
  perform private.require_second_approval('setting_update');
  insert into public.platform_settings (key, value, updated_by) values (p_key, p_value, auth.uid())
  on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = now();
end $$;

create function public.request_change(p_kind text, p_target text, p_payload jsonb, p_reason text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  cid uuid;
begin
  if not private.is_platform_admin() then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
  insert into public.change_requests (kind, target, payload, reason) values (p_kind, p_target, coalesce(p_payload, '{}'), p_reason) returning id into cid;
  return cid;
end $$;

-- A different platform admin approves (applied atomically) or rejects.
create function public.decide_change(p_id uuid, p_approve boolean, p_note text default null) returns text
language plpgsql security definer set search_path = '' as $$
declare
  c public.change_requests;
begin
  if not private.is_platform_admin() then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
  select * into c from public.change_requests where id = p_id for update;
  if not found or c.status <> 'pending' then
    raise exception 'Change request not found or already decided' using errcode = 'P0002';
  end if;
  if c.requested_by = auth.uid() then
    raise exception 'A second admin must decide this change' using errcode = '42501';
  end if;
  if not p_approve then
    update public.change_requests set status = 'rejected', decided_by = auth.uid(), decided_at = now(), decision_note = p_note where id = c.id;
    return 'rejected';
  end if;
  begin
    perform set_config('app.applying_change', c.kind, true);
    case c.kind
      when 'policy_activation' then perform public.activate_policy(c.target::uuid);
      when 'pack_upsert' then perform public.upsert_pack(c.target, c.payload ->> 'name', c.payload -> 'definition');
      when 'market_upsert' then perform public.upsert_market(c.payload);
      when 'dataset_update' then perform public.update_dataset(c.target, array(select jsonb_array_elements_text(c.payload -> 'allowed_uses')), (c.payload ->> 'min_group_size')::int);
      when 'setting_update' then perform public.set_platform_setting(c.target, c.payload -> 'value');
    end case;
    perform set_config('app.applying_change', '', true);
    update public.change_requests set status = 'applied', decided_by = auth.uid(), decided_at = now(), decision_note = p_note where id = c.id;
    return 'applied';
  exception when others then
    perform set_config('app.applying_change', '', true);
    update public.change_requests set status = 'failed', decided_by = auth.uid(), decided_at = now(), decision_note = p_note, error = sqlerrm where id = c.id;
    return 'failed';
  end;
end $$;

-- ─── Failure / retry visibility ───────────────────────────────────────────────
create function public.job_overview(p_hours int default 24) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_platform_admin() then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'by_type', (select coalesce(jsonb_agg(jsonb_build_object('type', type, 'queued', q, 'running', r, 'succeeded', s, 'failed_retrying', f, 'dead', d,
                  'avg_attempts', a) order by d desc, f desc, type), '[]') from (
        select type, count(*) filter (where status = 'queued') q, count(*) filter (where status = 'running') r,
          count(*) filter (where status = 'succeeded') s, count(*) filter (where status = 'failed') f, count(*) filter (where status = 'dead') d,
          round(avg(attempts), 2) a
        from public.jobs where updated_at > now() - make_interval(hours => p_hours) group by type) x),
    'dead', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'type', type, 'attempts', attempts, 'last_error', left(last_error, 300), 'at', updated_at)
                order by updated_at desc), '[]') from (select * from public.jobs where status = 'dead' order by updated_at desc limit 50) j),
    'deliveries', jsonb_build_object(
      'webhooks_failed_24h', (select count(*) from public.webhook_deliveries where status = 'failed' and created_at > now() - interval '24 hours')));
end $$;

create function public.requeue_job(p_job_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  j public.jobs;
begin
  if not private.is_platform_admin() then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
  update public.jobs set status = 'queued', attempts = 0, run_at = now(), locked_at = null where id = p_job_id and status = 'dead' returning * into j;
  if not found then
    raise exception 'Only dead jobs can be requeued' using errcode = 'P0002';
  end if;
  if j.business_id is not null then
    perform private.emit_event(j.business_id, 'job.requeued', 'job', j.id, jsonb_build_object('type', j.type, 'by', auth.uid()));
  end if;
end $$;

revoke execute on function public.update_dataset(text, text[], int), public.set_platform_setting(text, jsonb), public.request_change(text, text, jsonb, text),
  public.decide_change(uuid, boolean, text), public.job_overview(int), public.requeue_job(uuid) from public, anon;
grant execute on function public.update_dataset(text, text[], int), public.set_platform_setting(text, jsonb), public.request_change(text, text, jsonb, text),
  public.decide_change(uuid, boolean, text), public.job_overview(int), public.requeue_job(uuid) to authenticated;

alter table public.platform_settings enable row level security;
alter table public.change_requests enable row level security;
create policy "settings: admins" on public.platform_settings for select to authenticated using (private.is_platform_admin());
create policy "changes: admins" on public.change_requests for select to authenticated using (private.is_platform_admin());
revoke insert, update, delete on public.platform_settings, public.change_requests from authenticated;
