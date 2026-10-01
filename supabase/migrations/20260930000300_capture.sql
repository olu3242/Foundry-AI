-- Batch 5: Capture → Confirm.
-- A capture (text / voice transcript / photo) becomes AI-proposed record drafts.
-- Nothing reaches the books until a person confirms it; every record keeps its source.

create type public.capture_channel as enum ('text', 'voice', 'photo', 'forward');
create type public.capture_status as enum ('received', 'processing', 'drafted', 'resolved', 'failed');
create type public.record_kind as enum ('sale', 'expense', 'stock_movement', 'customer');
create type public.draft_status as enum ('proposed', 'confirmed', 'rejected');
create type public.payment_method as enum ('cash', 'transfer', 'mobile_money', 'card', 'credit', 'other');
create type public.stock_reason as enum ('purchase', 'sale', 'adjustment', 'waste', 'return');
-- Verification ladder (Batch 8 raises levels through verifications).
create type public.provenance as enum ('self_reported', 'document_backed', 'third_party_verified', 'institution_verified');

-- ─── Captures & AI runs ───────────────────────────────────────────────────────
create table public.captures (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.businesses (id) on delete cascade,
  created_by    uuid not null default auth.uid() references public.profiles (id),
  channel       public.capture_channel not null,
  raw_text      text check (char_length(raw_text) <= 4000),
  storage_path  text,
  mime_type     text,
  client_ref    text check (char_length(client_ref) <= 100),
  status        public.capture_status not null default 'received',
  error         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  processed_at  timestamptz,
  constraint captures_has_content check (raw_text is not null or storage_path is not null),
  constraint captures_path_scoped check (storage_path is null or storage_path like business_id::text || '/%')
);
create index captures_business_time_idx on public.captures (business_id, created_at desc);
create unique index captures_client_ref_idx on public.captures (business_id, client_ref) where client_ref is not null;
create trigger captures_touch before update on public.captures
  for each row execute function private.touch_updated_at();

create table public.agent_runs (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references public.businesses (id) on delete cascade,
  agent          text not null,
  trigger        text not null,
  subject_type   text,
  subject_id     uuid,
  model          text,
  status         text not null check (status in ('succeeded', 'failed', 'refused')),
  output         jsonb,
  input_tokens   int,
  output_tokens  int,
  latency_ms     int,
  error          text,
  created_at     timestamptz not null default now()
);
create index agent_runs_business_time_idx on public.agent_runs (business_id, created_at desc);

create table public.record_drafts (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.businesses (id) on delete cascade,
  capture_id    uuid not null references public.captures (id) on delete cascade,
  agent_run_id  uuid references public.agent_runs (id) on delete set null,
  kind          public.record_kind not null,
  fields        jsonb not null,
  confidence    numeric(3, 2) not null check (confidence between 0 and 1),
  evidence      jsonb not null default '[]',
  explanation   text,
  status        public.draft_status not null default 'proposed',
  confirmed_by  uuid references public.profiles (id),
  confirmed_at  timestamptz,
  record_id     uuid,
  created_at    timestamptz not null default now()
);
create index record_drafts_capture_idx on public.record_drafts (capture_id);
create index record_drafts_pending_idx on public.record_drafts (business_id, created_at desc) where status = 'proposed';

-- ─── Books ────────────────────────────────────────────────────────────────────
create table public.customers (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references public.businesses (id) on delete cascade,
  name             text not null check (char_length(name) between 1 and 120),
  phone            text check (char_length(phone) <= 32),
  notes            text check (char_length(notes) <= 1000),
  provenance       public.provenance not null default 'self_reported',
  source_draft_id  uuid references public.record_drafts (id) on delete set null,
  created_by       uuid default auth.uid() references public.profiles (id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create unique index customers_name_idx on public.customers (business_id, lower(name));

create table public.products (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null references public.businesses (id) on delete cascade,
  name              text not null check (char_length(name) between 1 and 120),
  unit              text check (char_length(unit) <= 30),
  unit_price_minor  bigint check (unit_price_minor >= 0),
  stock_qty         numeric(14, 3) not null default 0,
  reorder_level     numeric(14, 3),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create unique index products_name_idx on public.products (business_id, lower(name));

create table public.sales (
  id                 uuid primary key default gen_random_uuid(),
  business_id        uuid not null references public.businesses (id) on delete cascade,
  occurred_at        timestamptz not null default now(),
  customer_id        uuid references public.customers (id) on delete set null,
  total_minor        bigint not null check (total_minor >= 0),
  amount_paid_minor  bigint not null check (amount_paid_minor >= 0),
  currency           text not null check (currency ~ '^[A-Z]{3}$'),
  payment_method     public.payment_method not null default 'cash',
  notes              text check (char_length(notes) <= 1000),
  provenance         public.provenance not null default 'self_reported',
  source_capture_id  uuid references public.captures (id) on delete set null,
  source_draft_id    uuid references public.record_drafts (id) on delete set null,
  created_by         uuid default auth.uid() references public.profiles (id),
  voided_at          timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint sales_paid_le_total check (amount_paid_minor <= total_minor)
);
create index sales_business_time_idx on public.sales (business_id, occurred_at desc);

create table public.sale_items (
  id                uuid primary key default gen_random_uuid(),
  business_id       uuid not null references public.businesses (id) on delete cascade,
  sale_id           uuid not null references public.sales (id) on delete cascade,
  product_id        uuid references public.products (id) on delete set null,
  description       text not null check (char_length(description) between 1 and 200),
  quantity          numeric(14, 3) not null check (quantity > 0),
  unit_price_minor  bigint not null check (unit_price_minor >= 0),
  line_total_minor  bigint not null check (line_total_minor >= 0)
);
create index sale_items_sale_idx on public.sale_items (sale_id);

create table public.expenses (
  id                 uuid primary key default gen_random_uuid(),
  business_id        uuid not null references public.businesses (id) on delete cascade,
  occurred_at        timestamptz not null default now(),
  category           text not null check (char_length(category) between 1 and 60),
  description        text check (char_length(description) <= 300),
  amount_minor       bigint not null check (amount_minor >= 0),
  currency           text not null check (currency ~ '^[A-Z]{3}$'),
  payment_method     public.payment_method not null default 'cash',
  supplier           text check (char_length(supplier) <= 120),
  provenance         public.provenance not null default 'self_reported',
  source_capture_id  uuid references public.captures (id) on delete set null,
  source_draft_id    uuid references public.record_drafts (id) on delete set null,
  created_by         uuid default auth.uid() references public.profiles (id),
  voided_at          timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index expenses_business_time_idx on public.expenses (business_id, occurred_at desc);

create table public.stock_movements (
  id                 uuid primary key default gen_random_uuid(),
  business_id        uuid not null references public.businesses (id) on delete cascade,
  product_id         uuid not null references public.products (id) on delete cascade,
  occurred_at        timestamptz not null default now(),
  quantity_delta     numeric(14, 3) not null check (quantity_delta <> 0),
  reason             public.stock_reason not null,
  unit_cost_minor    bigint check (unit_cost_minor >= 0),
  notes              text check (char_length(notes) <= 500),
  provenance         public.provenance not null default 'self_reported',
  sale_id            uuid references public.sales (id) on delete cascade,
  source_capture_id  uuid references public.captures (id) on delete set null,
  source_draft_id    uuid references public.record_drafts (id) on delete set null,
  created_by         uuid default auth.uid() references public.profiles (id),
  created_at         timestamptz not null default now()
);
create index stock_movements_product_idx on public.stock_movements (product_id, occurred_at desc);

create trigger customers_touch before update on public.customers for each row execute function private.touch_updated_at();
create trigger products_touch before update on public.products for each row execute function private.touch_updated_at();
create trigger sales_touch before update on public.sales for each row execute function private.touch_updated_at();
create trigger expenses_touch before update on public.expenses for each row execute function private.touch_updated_at();

create trigger sales_audit after insert or update or delete on public.sales for each row execute function private.audit_row();
create trigger expenses_audit after insert or update or delete on public.expenses for each row execute function private.audit_row();
create trigger stock_audit after insert or update or delete on public.stock_movements for each row execute function private.audit_row();
create trigger customers_audit after insert or update or delete on public.customers for each row execute function private.audit_row();

-- Stock level is derived from movements (the movement log is the source of truth).
create function private.apply_stock_movement() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    update public.products set stock_qty = stock_qty + new.quantity_delta where id = new.product_id;
  elsif tg_op = 'DELETE' then
    update public.products set stock_qty = stock_qty - old.quantity_delta where id = old.product_id;
  end if;
  return coalesce(new, old);
end $$;
create trigger stock_movements_apply after insert or delete on public.stock_movements
  for each row execute function private.apply_stock_movement();

-- Every capture gets processed, whichever door it came in through.
create function private.on_capture_created() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.enqueue_job('capture.extract', new.business_id, jsonb_build_object('capture_id', new.id),
                              'capture:' || new.id, now(), 4, 50::smallint);
  perform private.emit_event(new.business_id, 'capture.received', 'capture', new.id,
                             jsonb_build_object('channel', new.channel));
  return new;
end $$;
create trigger captures_enqueue after insert on public.captures
  for each row execute function private.on_capture_created();

-- ─── Confirm / reject ─────────────────────────────────────────────────────────
create function private.find_or_create_customer(p_business_id uuid, p_name text, p_phone text default null, p_draft_id uuid default null)
returns uuid
language plpgsql set search_path = '' as $$
declare
  cid uuid;
begin
  if coalesce(trim(p_name), '') = '' then
    return null;
  end if;
  select id into cid from public.customers where business_id = p_business_id and lower(name) = lower(trim(p_name));
  if cid is null then
    insert into public.customers (business_id, name, phone, source_draft_id)
    values (p_business_id, trim(p_name), nullif(trim(p_phone), ''), p_draft_id)
    returning id into cid;
  end if;
  return cid;
end $$;

create function private.find_or_create_product(p_business_id uuid, p_name text, p_unit_price bigint default null)
returns uuid
language plpgsql set search_path = '' as $$
declare
  pid uuid;
begin
  if coalesce(trim(p_name), '') = '' then
    return null;
  end if;
  select id into pid from public.products where business_id = p_business_id and lower(name) = lower(trim(p_name));
  if pid is null then
    insert into public.products (business_id, name, unit_price_minor) values (p_business_id, trim(p_name), p_unit_price)
    returning id into pid;
  end if;
  return pid;
end $$;

/*
 * Writes a confirmed draft into the books. SECURITY INVOKER: every insert is checked
 * by the caller's RLS. p_fields is the (possibly edited) payload; shapes per kind:
 *   sale:           {occurred_at?, customer_name?, items:[{description, quantity, unit_price_minor, product_name?}],
 *                    total_minor, amount_paid_minor?, payment_method, notes?}
 *   expense:        {occurred_at?, category, description?, amount_minor, payment_method, supplier?}
 *   stock_movement: {occurred_at?, product_name, quantity_delta, reason, unit_cost_minor?, notes?}
 *   customer:       {name, phone?, notes?}
 */
create function public.confirm_draft(p_draft_id uuid, p_fields jsonb default null) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  d public.record_drafts;
  f jsonb;
  b public.businesses;
  rid uuid;
  pid uuid;
  item jsonb;
  total bigint;
  cur text;
  at timestamptz;
begin
  select * into d from public.record_drafts where id = p_draft_id for update;
  if not found or not private.can_write(d.business_id) then
    raise exception 'Draft not found' using errcode = 'P0002';
  end if;
  if d.status <> 'proposed' then
    raise exception 'This draft was already %', d.status using errcode = 'P0001';
  end if;
  select * into b from public.businesses where id = d.business_id;
  f := coalesce(p_fields, d.fields);
  cur := b.currency;
  at := coalesce((f ->> 'occurred_at')::timestamptz, now());

  if d.kind = 'sale' then
    total := (f ->> 'total_minor')::bigint;
    insert into public.sales (business_id, occurred_at, customer_id, total_minor, amount_paid_minor, currency,
                              payment_method, notes, source_capture_id, source_draft_id)
    values (d.business_id, at,
            private.find_or_create_customer(d.business_id, f ->> 'customer_name', null, d.id),
            total,
            coalesce((f ->> 'amount_paid_minor')::bigint, case when f ->> 'payment_method' = 'credit' then 0 else total end),
            cur, coalesce(f ->> 'payment_method', 'cash')::public.payment_method, f ->> 'notes', d.capture_id, d.id)
    returning id into rid;
    for item in select * from jsonb_array_elements(coalesce(f -> 'items', '[]')) loop
      pid := private.find_or_create_product(d.business_id, item ->> 'product_name', (item ->> 'unit_price_minor')::bigint);
      insert into public.sale_items (business_id, sale_id, product_id, description, quantity, unit_price_minor, line_total_minor)
      values (d.business_id, rid, pid, coalesce(item ->> 'description', item ->> 'product_name'),
              (item ->> 'quantity')::numeric, (item ->> 'unit_price_minor')::bigint,
              round((item ->> 'quantity')::numeric * (item ->> 'unit_price_minor')::bigint));
      if pid is not null then
        insert into public.stock_movements (business_id, product_id, occurred_at, quantity_delta, reason, sale_id, source_capture_id, source_draft_id)
        values (d.business_id, pid, at, -(item ->> 'quantity')::numeric, 'sale', rid, d.capture_id, d.id);
      end if;
    end loop;
    perform private.emit_event(d.business_id, 'sale.recorded', 'sale', rid,
      jsonb_build_object('total_minor', total, 'currency', cur, 'payment_method', f ->> 'payment_method'));

  elsif d.kind = 'expense' then
    insert into public.expenses (business_id, occurred_at, category, description, amount_minor, currency, payment_method,
                                 supplier, source_capture_id, source_draft_id)
    values (d.business_id, at, coalesce(nullif(trim(f ->> 'category'), ''), 'Other'), f ->> 'description',
            (f ->> 'amount_minor')::bigint, cur, coalesce(f ->> 'payment_method', 'cash')::public.payment_method,
            f ->> 'supplier', d.capture_id, d.id)
    returning id into rid;
    perform private.emit_event(d.business_id, 'expense.recorded', 'expense', rid,
      jsonb_build_object('amount_minor', (f ->> 'amount_minor')::bigint, 'currency', cur, 'category', f ->> 'category'));

  elsif d.kind = 'stock_movement' then
    pid := private.find_or_create_product(d.business_id, f ->> 'product_name');
    if pid is null then
      raise exception 'A product name is required' using errcode = 'P0001';
    end if;
    insert into public.stock_movements (business_id, product_id, occurred_at, quantity_delta, reason, unit_cost_minor, notes,
                                        source_capture_id, source_draft_id)
    values (d.business_id, pid, at, (f ->> 'quantity_delta')::numeric, (f ->> 'reason')::public.stock_reason,
            (f ->> 'unit_cost_minor')::bigint, f ->> 'notes', d.capture_id, d.id)
    returning id into rid;
    perform private.emit_event(d.business_id, 'stock.moved', 'stock_movement', rid,
      jsonb_build_object('product', f ->> 'product_name', 'delta', (f ->> 'quantity_delta')::numeric, 'reason', f ->> 'reason'));

  elsif d.kind = 'customer' then
    rid := private.find_or_create_customer(d.business_id, f ->> 'name', f ->> 'phone', d.id);
    perform private.emit_event(d.business_id, 'customer.added', 'customer', rid, jsonb_build_object('name', f ->> 'name'));
  end if;

  update public.record_drafts
  set status = 'confirmed', fields = f, confirmed_by = auth.uid(), confirmed_at = now(), record_id = rid
  where id = d.id;
  perform private.resolve_capture_if_done(d.capture_id);
  return rid;
end $$;

create function public.reject_draft(p_draft_id uuid) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  d public.record_drafts;
begin
  update public.record_drafts set status = 'rejected', confirmed_by = auth.uid(), confirmed_at = now()
  where id = p_draft_id and status = 'proposed'
  returning * into d;
  if not found then
    raise exception 'Draft not found or already handled' using errcode = 'P0002';
  end if;
  perform private.emit_event(d.business_id, 'draft.rejected', 'draft', d.id, jsonb_build_object('kind', d.kind));
  perform private.resolve_capture_if_done(d.capture_id);
end $$;

create function private.resolve_capture_if_done(p_capture_id uuid) returns void
language sql security definer set search_path = '' as $$
  update public.captures set status = 'resolved'
  where id = p_capture_id and status = 'drafted'
    and not exists (select 1 from public.record_drafts where capture_id = p_capture_id and status = 'proposed');
$$;

revoke execute on function public.confirm_draft(uuid, jsonb), public.reject_draft(uuid) from public, anon;
grant execute on function public.confirm_draft(uuid, jsonb), public.reject_draft(uuid) to authenticated;
grant execute on function private.find_or_create_customer(uuid, text, text, uuid),
  private.find_or_create_product(uuid, text, bigint) to authenticated;

-- ─── RLS ──────────────────────────────────────────────────────────────────────
alter table public.captures enable row level security;
alter table public.agent_runs enable row level security;
alter table public.record_drafts enable row level security;
alter table public.customers enable row level security;
alter table public.products enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.expenses enable row level security;
alter table public.stock_movements enable row level security;

create policy "captures: read" on public.captures for select to authenticated using (private.can_read(business_id));
create policy "captures: write" on public.captures for insert to authenticated
  with check (private.can_write(business_id) and created_by = (select auth.uid()));
create policy "agent_runs: read" on public.agent_runs for select to authenticated using (private.can_read(business_id));
create policy "drafts: read" on public.record_drafts for select to authenticated using (private.can_read(business_id));
create policy "drafts: decide" on public.record_drafts for update to authenticated
  using (private.can_write(business_id)) with check (private.can_write(business_id));

-- Books: readers read; operators write. Deletes are not allowed (void instead).
do $$
declare
  t text;
begin
  foreach t in array array['customers', 'products', 'sales', 'sale_items', 'expenses', 'stock_movements'] loop
    execute format('create policy "%1$s: read" on public.%1$I for select to authenticated using (private.can_read(business_id))', t);
    execute format('create policy "%1$s: insert" on public.%1$I for insert to authenticated with check (private.can_write(business_id))', t);
    execute format('create policy "%1$s: update" on public.%1$I for update to authenticated using (private.can_write(business_id)) with check (private.can_write(business_id))', t);
  end loop;
end $$;

revoke delete on public.captures, public.record_drafts, public.customers, public.products, public.sales,
  public.sale_items, public.expenses, public.stock_movements from authenticated;
revoke insert, update, delete on public.agent_runs from authenticated;
revoke insert, delete on public.record_drafts from authenticated;

-- ─── Storage: capture photos, private, foldered by business id ─────────────────
-- Guarded so the migration also applies where the storage service isn't installed (db-only CI).
do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'storage schema not present; skipping captures bucket';
    return;
  end if;
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('captures', 'captures', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do nothing;
  create policy "captures bucket: read" on storage.objects for select to authenticated
    using (bucket_id = 'captures' and private.can_read(((storage.foldername(name))[1])::uuid));
  create policy "captures bucket: upload" on storage.objects for insert to authenticated
    with check (bucket_id = 'captures' and private.can_write(((storage.foldername(name))[1])::uuid));
end $$;
