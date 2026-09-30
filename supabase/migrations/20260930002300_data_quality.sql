-- B25 Data quality: duplicate / conflict / staleness / missing-period detection, reconciliation,
-- and correction lineage. Historical evidence is never destroyed: corrections void and supersede,
-- gaps are explained (not filled with invented numbers), and unknown stays unknown.
-- Reuses B5 records + provenance, B6 void_record/write_record, B8 verifications, B24 attestations.

alter table public.sales add column supersedes uuid references public.sales (id);
alter table public.expenses add column supersedes uuid references public.expenses (id);

-- Owner-declared periods without trading (closed, travelling, holiday). Explains a gap.
create table public.no_trading_periods (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.businesses (id) on delete cascade,
  period_start  date not null,
  period_end    date not null check (period_end >= period_start),
  reason        text not null check (reason in ('closed', 'travel', 'holiday', 'stock_out', 'other')),
  created_by    uuid not null default auth.uid() references public.profiles (id),
  created_at    timestamptz not null default now()
);
create index no_trading_periods_business_idx on public.no_trading_periods (business_id, period_start);

create table public.record_corrections (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses (id) on delete cascade,
  subject_type    text not null check (subject_type in ('sale', 'expense', 'product')),
  subject_id      uuid not null,
  action          text not null check (action in ('correct', 'void_duplicate', 'stock_adjustment')),
  replacement_id  uuid,
  issue_id        uuid,
  before          jsonb,
  after           jsonb,
  reason          text,
  corrected_by    uuid not null default auth.uid() references public.profiles (id),
  corrected_at    timestamptz not null default now()
);
create index record_corrections_business_idx on public.record_corrections (business_id, corrected_at desc);
create index record_corrections_subject_idx on public.record_corrections (subject_id);

create table public.data_quality_issues (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses (id) on delete cascade,
  kind         text not null check (kind in ('duplicate', 'conflict', 'missing_period', 'stale')),
  fingerprint  text not null,
  subject      jsonb not null,
  detail       text not null,
  status       text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  resolution   jsonb,
  detected_at  timestamptz not null default now(),
  resolved_at  timestamptz,
  resolved_by  uuid references public.profiles (id)
);
create unique index data_quality_issues_fingerprint on public.data_quality_issues (business_id, fingerprint);
create index data_quality_issues_open_idx on public.data_quality_issues (business_id) where status = 'open';
create trigger data_quality_issues_audit after insert or update on public.data_quality_issues for each row execute function private.audit_row();

create function private.log_correction(bid uuid, st text, sid uuid, act text, rid uuid, iid uuid, b jsonb, a jsonb, why text) returns uuid
language sql security definer set search_path = '' as $$
  insert into public.record_corrections (business_id, subject_type, subject_id, action, replacement_id, issue_id, before, after, reason)
  values (bid, st, sid, act, rid, iid, b, a, why) returning id;
$$;

-- ─── Detection ────────────────────────────────────────────────────────────────
create function public.scan_data_quality(p_business_id uuid default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  found_n int := 0;
  closed_n int := 0;
  k int;
begin
  if p_business_id is null then
    if coalesce(auth.role(), '') <> 'service_role' and not private.is_platform_admin() then
      raise exception 'Platform admins only' using errcode = '42501';
    end if;
  elsif not (private.can_write(p_business_id) or coalesce(auth.role(), '') = 'service_role' or private.is_platform_admin()) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  -- Duplicates: same amount, method and customer within 15 minutes.
  insert into public.data_quality_issues (business_id, kind, fingerprint, subject, detail)
  select a.business_id, 'duplicate', 'dup:sale:' || a.id || ':' || b.id,
    jsonb_build_object('record_type', 'sale', 'ids', jsonb_build_array(a.id, b.id), 'total_minor', a.total_minor, 'occurred_at', a.occurred_at),
    'Two sales of the same amount ' || abs(extract(epoch from b.occurred_at - a.occurred_at))::int / 60 || ' min apart'
  from public.sales a join public.sales b on b.business_id = a.business_id and b.id > a.id
    and b.total_minor = a.total_minor and b.payment_method = a.payment_method and b.customer_id is not distinct from a.customer_id
    and abs(extract(epoch from b.occurred_at - a.occurred_at)) <= 900
  where a.voided_at is null and b.voided_at is null and (p_business_id is null or a.business_id = p_business_id)
    and a.occurred_at > now() - interval '180 days'
  on conflict (business_id, fingerprint) do nothing;
  get diagnostics k = row_count; found_n := found_n + k;

  insert into public.data_quality_issues (business_id, kind, fingerprint, subject, detail)
  select a.business_id, 'duplicate', 'dup:expense:' || a.id || ':' || b.id,
    jsonb_build_object('record_type', 'expense', 'ids', jsonb_build_array(a.id, b.id), 'amount_minor', a.amount_minor, 'occurred_at', a.occurred_at),
    'Two ' || a.category || ' expenses of the same amount ' || abs(extract(epoch from b.occurred_at - a.occurred_at))::int / 60 || ' min apart'
  from public.expenses a join public.expenses b on b.business_id = a.business_id and b.id > a.id
    and b.amount_minor = a.amount_minor and lower(b.category) = lower(a.category) and abs(extract(epoch from b.occurred_at - a.occurred_at)) <= 900
  where a.voided_at is null and b.voided_at is null and (p_business_id is null or a.business_id = p_business_id)
    and a.occurred_at > now() - interval '180 days'
  on conflict (business_id, fingerprint) do nothing;
  get diagnostics k = row_count; found_n := found_n + k;

  -- Conflicts: stock below zero means sales and stock records disagree.
  insert into public.data_quality_issues (business_id, kind, fingerprint, subject, detail)
  select p.business_id, 'conflict', 'neg:' || p.id, jsonb_build_object('record_type', 'product', 'product_id', p.id, 'name', p.name, 'stock_qty', p.stock_qty),
    p.name || ' shows ' || p.stock_qty || ' in stock: more was sold than recorded as bought'
  from public.products p where p.stock_qty < 0 and (p_business_id is null or p.business_id = p_business_id)
  on conflict (business_id, fingerprint) do nothing;
  get diagnostics k = row_count; found_n := found_n + k;

  -- Missing periods: silent weeks inside an otherwise regular trading pattern (last 26 weeks),
  -- unless the owner explained them.
  insert into public.data_quality_issues (business_id, kind, fingerprint, subject, detail)
  with rec as (
    select business_id, date_trunc('week', occurred_at)::date wk from public.sales where voided_at is null
      and (p_business_id is null or business_id = p_business_id) and occurred_at > now() - interval '26 weeks'
    union select business_id, date_trunc('week', occurred_at)::date from public.expenses where voided_at is null
      and (p_business_id is null or business_id = p_business_id) and occurred_at > now() - interval '26 weeks'
  ),
  span as (select business_id, min(wk) first_wk, count(distinct wk) active from rec group by business_id having count(distinct wk) >= 4),
  weeks as (
    select s.business_id, g::date wk from span s,
      generate_series(s.first_wk, date_trunc('week', now())::date - 7, interval '1 week') g
  )
  select w.business_id, 'missing_period', 'gap:' || w.wk, jsonb_build_object('week_start', w.wk, 'week_end', w.wk + 6),
    'No records for the week of ' || to_char(w.wk, 'DD Mon')
  from weeks w
  where not exists (select 1 from rec r where r.business_id = w.business_id and r.wk = w.wk)
    and not exists (select 1 from public.no_trading_periods n where n.business_id = w.business_id and n.period_start <= w.wk + 6 and n.period_end >= w.wk)
  on conflict (business_id, fingerprint) do nothing;
  get diagnostics k = row_count; found_n := found_n + k;

  -- Staleness: a record-keeping business that stopped for 14+ days.
  insert into public.data_quality_issues (business_id, kind, fingerprint, subject, detail)
  select l.business_id, 'stale', 'stale:' || to_char(l.last_at, 'YYYY-MM-DD'), jsonb_build_object('last_record_at', l.last_at),
    'Nothing recorded since ' || to_char(l.last_at, 'DD Mon')
  from (select business_id, max(occurred_at) last_at from (
          select business_id, occurred_at from public.sales where voided_at is null
          union all select business_id, occurred_at from public.expenses where voided_at is null) x
        where p_business_id is null or business_id = p_business_id group by business_id) l
  where l.last_at < now() - interval '14 days'
  on conflict (business_id, fingerprint) do nothing;
  get diagnostics k = row_count; found_n := found_n + k;

  -- Close issues whose condition no longer holds (a duplicate voided, stock counted, a gap filled
  -- or explained, recording resumed).
  update public.data_quality_issues i set status = 'resolved', resolved_at = now(), resolution = coalesce(i.resolution, '{}') || '{"auto": true}'
  where i.status = 'open' and (p_business_id is null or i.business_id = p_business_id) and (
    (i.kind = 'duplicate' and i.subject ->> 'record_type' = 'sale' and exists (
       select 1 from public.sales s where s.id in (select (jsonb_array_elements_text(i.subject -> 'ids'))::uuid) and s.voided_at is not null))
    or (i.kind = 'duplicate' and i.subject ->> 'record_type' = 'expense' and exists (
       select 1 from public.expenses e where e.id in (select (jsonb_array_elements_text(i.subject -> 'ids'))::uuid) and e.voided_at is not null))
    or (i.kind = 'conflict' and not exists (select 1 from public.products p where p.id = (i.subject ->> 'product_id')::uuid and p.stock_qty < 0))
    or (i.kind = 'missing_period' and (
         exists (select 1 from public.no_trading_periods n where n.business_id = i.business_id
                 and n.period_start <= (i.subject ->> 'week_end')::date and n.period_end >= (i.subject ->> 'week_start')::date)
      or exists (select 1 from public.sales s where s.business_id = i.business_id and s.voided_at is null
                 and s.occurred_at::date between (i.subject ->> 'week_start')::date and (i.subject ->> 'week_end')::date)))
    or (i.kind = 'stale' and exists (select 1 from public.sales s where s.business_id = i.business_id and s.voided_at is null
                 and s.occurred_at > (i.subject ->> 'last_record_at')::timestamptz))
  );
  get diagnostics closed_n = row_count;
  return jsonb_build_object('found', found_n, 'auto_resolved', closed_n);
end $$;

-- ─── Reconciliation ───────────────────────────────────────────────────────────
create function public.resolve_quality_issue(p_issue_id uuid, p_action text, p_params jsonb default '{}', p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  i public.data_quality_issues;
  rid uuid;
  delta numeric;
  p public.products;
begin
  select * into i from public.data_quality_issues where id = p_issue_id for update;
  if not found or not private.can_write(i.business_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if i.status <> 'open' then
    raise exception 'This issue is already closed' using errcode = 'P0001';
  end if;
  if p_action = 'void_duplicate' and i.kind = 'duplicate' then
    rid := (p_params ->> 'record_id')::uuid;
    if not (i.subject -> 'ids') ? rid::text then
      raise exception 'Choose one of the two records' using errcode = '22023';
    end if;
    if i.subject ->> 'record_type' = 'sale' then
      update public.sales set voided_at = now(), notes = concat_ws(' · ', notes, 'Voided: duplicate') where id = rid and voided_at is null;
      insert into public.stock_movements (business_id, product_id, quantity_delta, reason, notes, sale_id)
      select business_id, product_id, -quantity_delta, 'return', 'Reversal of duplicate sale', sale_id from public.stock_movements where sale_id = rid and reason = 'sale';
    else
      update public.expenses set voided_at = now(), description = concat_ws(' · ', description, 'Voided: duplicate') where id = rid and voided_at is null;
    end if;
    perform private.log_correction(i.business_id, i.subject ->> 'record_type', rid, 'void_duplicate', null, i.id, i.subject, null, p_note);
    perform private.emit_event(i.business_id, (i.subject ->> 'record_type') || '.voided', i.subject ->> 'record_type', rid, jsonb_build_object('reason', 'duplicate'));
  elsif p_action = 'explain_gap' and i.kind = 'missing_period' then
    insert into public.no_trading_periods (business_id, period_start, period_end, reason)
    values (i.business_id, (i.subject ->> 'week_start')::date, (i.subject ->> 'week_end')::date, coalesce(p_params ->> 'reason', 'other'));
  elsif p_action = 'adjust_stock' and i.kind = 'conflict' then
    select * into p from public.products where id = (i.subject ->> 'product_id')::uuid;
    delta := (p_params ->> 'counted')::numeric - p.stock_qty;
    if (p_params ->> 'counted') is null or (p_params ->> 'counted')::numeric < 0 then
      raise exception 'Enter how many you counted' using errcode = '22023';
    end if;
    if delta <> 0 then
      insert into public.stock_movements (business_id, product_id, quantity_delta, reason, notes)
      values (p.business_id, p.id, delta, 'adjustment', 'Stock count: ' || (p_params ->> 'counted')) returning id into rid;
    end if;
    perform private.log_correction(i.business_id, 'product', p.id, 'stock_adjustment', rid, i.id,
      jsonb_build_object('stock_qty', p.stock_qty), jsonb_build_object('stock_qty', (p_params ->> 'counted')::numeric), p_note);
  elsif p_action not in ('dismiss', 'not_duplicate') then
    raise exception 'That action does not fit this issue' using errcode = '22023';
  end if;
  update public.data_quality_issues set status = case when p_action in ('dismiss', 'not_duplicate') then 'dismissed' else 'resolved' end,
    resolved_at = now(), resolved_by = auth.uid(), resolution = jsonb_build_object('action', p_action, 'params', p_params, 'note', p_note)
  where id = i.id;
end $$;

-- Correct a sale or expense: the original is voided (kept), a new record supersedes it, and the
-- change is logged with before/after. Items can't be silently re-priced.
create function public.correct_record(p_kind public.record_kind, p_id uuid, p_fields jsonb, p_reason text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  bid uuid;
  before jsonb;
  f jsonb;
  nid uuid;
begin
  if char_length(coalesce(p_reason, '')) < 3 then
    raise exception 'Say why you are correcting this record' using errcode = '22023';
  end if;
  if p_kind = 'sale' then
    select business_id, to_jsonb(s) - 'created_at' - 'updated_at' into bid, before from public.sales s where id = p_id and voided_at is null;
  elsif p_kind = 'expense' then
    select business_id, to_jsonb(e) - 'created_at' - 'updated_at' into bid, before from public.expenses e where id = p_id and voided_at is null;
  else
    raise exception 'Only sales and expenses can be corrected' using errcode = 'P0001';
  end if;
  if bid is null then
    raise exception 'Record not found or already voided' using errcode = 'P0002';
  end if;
  if not private.can_write(bid) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if p_kind = 'sale' then
    if exists (select 1 from public.sale_items where sale_id = p_id) and (p_fields ? 'total_minor') and (p_fields ->> 'total_minor')::bigint <> (before ->> 'total_minor')::bigint then
      raise exception 'This sale has items: change the items to change the total' using errcode = 'P0001';
    end if;
    f := jsonb_build_object('occurred_at', before ->> 'occurred_at', 'total_minor', before -> 'total_minor', 'amount_paid_minor', before -> 'amount_paid_minor',
           'payment_method', before ->> 'payment_method', 'notes', before ->> 'notes',
           'customer_name', (select name from public.customers where id = (before ->> 'customer_id')::uuid),
           'items', (select coalesce(jsonb_agg(jsonb_build_object('product_name', p.name, 'description', i.description, 'quantity', i.quantity, 'unit_price_minor', i.unit_price_minor)), '[]')
                     from public.sale_items i left join public.products p on p.id = i.product_id where i.sale_id = p_id)) || p_fields;
  else
    f := jsonb_build_object('occurred_at', before ->> 'occurred_at', 'category', before ->> 'category', 'description', before ->> 'description',
           'amount_minor', before -> 'amount_minor', 'payment_method', before ->> 'payment_method', 'supplier', before ->> 'supplier') || p_fields;
  end if;
  -- Void first (reverses stock), then write the replacement through the normal path.
  if p_kind = 'sale' then
    update public.sales set voided_at = now(), notes = concat_ws(' · ', notes, 'Corrected: ' || p_reason) where id = p_id;
    insert into public.stock_movements (business_id, product_id, quantity_delta, reason, notes, sale_id)
    select business_id, product_id, -quantity_delta, 'return', 'Reversal of corrected sale', sale_id from public.stock_movements where sale_id = p_id and reason = 'sale';
  else
    update public.expenses set voided_at = now(), description = concat_ws(' · ', description, 'Corrected: ' || p_reason) where id = p_id;
  end if;
  nid := private.write_record(bid, p_kind, f);
  if p_kind = 'sale' then
    update public.sales set supersedes = p_id, provenance = (before ->> 'provenance')::public.provenance where id = nid;
  else
    update public.expenses set supersedes = p_id, provenance = (before ->> 'provenance')::public.provenance where id = nid;
  end if;
  perform private.log_correction(bid, p_kind::text, p_id, 'correct', nid, null, before, f, p_reason);
  perform private.emit_event(bid, p_kind::text || '.corrected', p_kind::text, nid, jsonb_build_object('supersedes', p_id, 'reason', p_reason));
  return nid;
end $$;

-- ─── Quality dimensions (each with its numbers; unknown stays null) ───────────
create function public.data_quality_score(p_business_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  first_at timestamptz;
  last_at timestamptz;
  from_wk date;
  weeks_total int;
  weeks_ok int;
  n90 int;
  open_bad int;
  strong int;
  verified int;
  dims jsonb;
begin
  if not private.can_read(p_business_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select min(occurred_at), max(occurred_at) into first_at, last_at from (
    select occurred_at from public.sales where business_id = p_business_id and voided_at is null
    union all select occurred_at from public.expenses where business_id = p_business_id and voided_at is null) x;
  if last_at is null then
    return jsonb_build_object('overall', null, 'records', 0, 'dimensions', jsonb_build_object(
      'completeness', null, 'consistency', null, 'recency', null, 'provenance', null, 'verification', null),
      'note', 'No records yet: quality is unknown, not zero.');
  end if;
  from_wk := greatest(date_trunc('week', first_at), date_trunc('week', now() - interval '12 weeks'))::date;
  select count(*), count(*) filter (where exists (
      select 1 from public.sales s where s.business_id = p_business_id and s.voided_at is null and s.occurred_at >= g and s.occurred_at < g + interval '1 week'
      union all select 1 from public.expenses e where e.business_id = p_business_id and e.voided_at is null and e.occurred_at >= g and e.occurred_at < g + interval '1 week'
      union all select 1 from public.no_trading_periods n where n.business_id = p_business_id and n.period_start <= (g + interval '6 days')::date and n.period_end >= g::date))
    into weeks_total, weeks_ok
  from generate_series(from_wk::timestamptz, date_trunc('week', now()), interval '1 week') g;
  select count(*), count(*) filter (where provenance <> 'self_reported') into n90, strong from (
    select provenance from public.sales where business_id = p_business_id and voided_at is null and occurred_at > now() - interval '90 days'
    union all select provenance from public.expenses where business_id = p_business_id and voided_at is null and occurred_at > now() - interval '90 days') x;
  select count(*) into open_bad from public.data_quality_issues where business_id = p_business_id and status = 'open' and kind in ('duplicate', 'conflict');
  select count(*) into verified from public.sales s where s.business_id = p_business_id and s.voided_at is null and s.occurred_at > now() - interval '90 days'
    and (s.provenance in ('third_party_verified', 'institution_verified') or exists (
      select 1 from public.attestations a join public.verification_requests r on r.id = a.request_id
      where a.business_id = p_business_id and a.status = 'active' and a.result = 'confirmed' and r.scope -> 'sale_ids' ? s.id::text));
  dims := jsonb_build_object(
    'completeness', jsonb_build_object('score', round(weeks_ok::numeric / nullif(weeks_total, 0), 3), 'weeks_covered', weeks_ok, 'weeks', weeks_total),
    'consistency', jsonb_build_object('score', case when n90 = 0 then null else round(greatest(0, 1 - open_bad::numeric / n90), 3) end, 'open_issues', open_bad, 'records_90d', n90),
    'recency', jsonb_build_object('score', case when last_at > now() - interval '2 days' then 1 when last_at > now() - interval '7 days' then 0.75
                                               when last_at > now() - interval '14 days' then 0.5 when last_at > now() - interval '30 days' then 0.25 else 0 end,
                                  'last_record_at', last_at),
    'provenance', jsonb_build_object('score', case when n90 = 0 then null else round(strong::numeric / n90, 3) end, 'backed', strong, 'records_90d', n90),
    'verification', jsonb_build_object('score', case when n90 = 0 then null else round(verified::numeric / n90, 3) end, 'verified_sales', verified, 'records_90d', n90));
  return jsonb_build_object('records', n90, 'dimensions', dims,
    'overall', (select round(avg((v ->> 'score')::numeric), 3) from jsonb_each(dims) d(k, v) where v ->> 'score' is not null),
    'open_issues', (select count(*) from public.data_quality_issues where business_id = p_business_id and status = 'open'));
end $$;

revoke execute on function public.scan_data_quality(uuid), public.resolve_quality_issue(uuid, text, jsonb, text),
  public.correct_record(public.record_kind, uuid, jsonb, text), public.data_quality_score(uuid) from public, anon;
grant execute on function public.scan_data_quality(uuid), public.resolve_quality_issue(uuid, text, jsonb, text),
  public.correct_record(public.record_kind, uuid, jsonb, text), public.data_quality_score(uuid) to authenticated;

alter table public.no_trading_periods enable row level security;
alter table public.record_corrections enable row level security;
alter table public.data_quality_issues enable row level security;
create policy "no trading: readers" on public.no_trading_periods for select to authenticated using (private.can_read(business_id));
create policy "corrections: readers" on public.record_corrections for select to authenticated using (private.can_read(business_id));
create policy "quality issues: readers" on public.data_quality_issues for select to authenticated using (private.can_read(business_id));
revoke insert, update, delete on public.no_trading_periods, public.record_corrections, public.data_quality_issues from authenticated;
