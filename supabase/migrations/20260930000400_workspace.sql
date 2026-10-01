-- Batch 6: one write path for the books (AI-confirmed and hand-entered records go through
-- private.write_record), voiding instead of deleting, and a period summary for dashboards.

create function private.write_record(
  p_business_id uuid, p_kind public.record_kind, f jsonb,
  p_capture_id uuid default null, p_draft_id uuid default null
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  cur text;
  at timestamptz := coalesce((f ->> 'occurred_at')::timestamptz, now());
  rid uuid;
  pid uuid;
  item jsonb;
  total bigint;
begin
  if not private.can_write(p_business_id) then
    raise exception 'You can''t record for this business' using errcode = '42501';
  end if;
  select currency into cur from public.businesses where id = p_business_id;

  if p_kind = 'sale' then
    total := (f ->> 'total_minor')::bigint;
    insert into public.sales (business_id, occurred_at, customer_id, total_minor, amount_paid_minor, currency,
                              payment_method, notes, source_capture_id, source_draft_id)
    values (p_business_id, at,
            private.find_or_create_customer(p_business_id, f ->> 'customer_name', null, p_draft_id),
            total,
            coalesce((f ->> 'amount_paid_minor')::bigint, case when f ->> 'payment_method' = 'credit' then 0 else total end),
            cur, coalesce(f ->> 'payment_method', 'cash')::public.payment_method, f ->> 'notes', p_capture_id, p_draft_id)
    returning id into rid;
    for item in select * from jsonb_array_elements(coalesce(f -> 'items', '[]')) loop
      pid := private.find_or_create_product(p_business_id, item ->> 'product_name', (item ->> 'unit_price_minor')::bigint);
      insert into public.sale_items (business_id, sale_id, product_id, description, quantity, unit_price_minor, line_total_minor)
      values (p_business_id, rid, pid, coalesce(item ->> 'description', item ->> 'product_name'),
              (item ->> 'quantity')::numeric, (item ->> 'unit_price_minor')::bigint,
              round((item ->> 'quantity')::numeric * (item ->> 'unit_price_minor')::bigint));
      if pid is not null then
        insert into public.stock_movements (business_id, product_id, occurred_at, quantity_delta, reason, sale_id, source_capture_id, source_draft_id)
        values (p_business_id, pid, at, -(item ->> 'quantity')::numeric, 'sale', rid, p_capture_id, p_draft_id);
      end if;
    end loop;
    perform private.emit_event(p_business_id, 'sale.recorded', 'sale', rid,
      jsonb_build_object('total_minor', total, 'currency', cur, 'payment_method', f ->> 'payment_method', 'via', case when p_draft_id is null then 'manual' else 'capture' end));

  elsif p_kind = 'expense' then
    insert into public.expenses (business_id, occurred_at, category, description, amount_minor, currency, payment_method,
                                 supplier, source_capture_id, source_draft_id)
    values (p_business_id, at, coalesce(nullif(trim(f ->> 'category'), ''), 'Other'), f ->> 'description',
            (f ->> 'amount_minor')::bigint, cur, coalesce(f ->> 'payment_method', 'cash')::public.payment_method,
            f ->> 'supplier', p_capture_id, p_draft_id)
    returning id into rid;
    perform private.emit_event(p_business_id, 'expense.recorded', 'expense', rid,
      jsonb_build_object('amount_minor', (f ->> 'amount_minor')::bigint, 'currency', cur, 'category', f ->> 'category'));

  elsif p_kind = 'stock_movement' then
    pid := private.find_or_create_product(p_business_id, f ->> 'product_name');
    if pid is null then
      raise exception 'A product name is required' using errcode = 'P0001';
    end if;
    insert into public.stock_movements (business_id, product_id, occurred_at, quantity_delta, reason, unit_cost_minor, notes,
                                        source_capture_id, source_draft_id)
    values (p_business_id, pid, at, (f ->> 'quantity_delta')::numeric, (f ->> 'reason')::public.stock_reason,
            (f ->> 'unit_cost_minor')::bigint, f ->> 'notes', p_capture_id, p_draft_id)
    returning id into rid;
    perform private.emit_event(p_business_id, 'stock.moved', 'stock_movement', rid,
      jsonb_build_object('product', f ->> 'product_name', 'delta', (f ->> 'quantity_delta')::numeric, 'reason', f ->> 'reason'));

  elsif p_kind = 'customer' then
    rid := private.find_or_create_customer(p_business_id, f ->> 'name', f ->> 'phone', p_draft_id);
    perform private.emit_event(p_business_id, 'customer.added', 'customer', rid, jsonb_build_object('name', f ->> 'name'));
  end if;
  return rid;
end $$;
grant execute on function private.write_record(uuid, public.record_kind, jsonb, uuid, uuid) to authenticated;

create or replace function public.confirm_draft(p_draft_id uuid, p_fields jsonb default null) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  d public.record_drafts;
  f jsonb;
  rid uuid;
begin
  select * into d from public.record_drafts where id = p_draft_id for update;
  if not found or not private.can_write(d.business_id) then
    raise exception 'Draft not found' using errcode = 'P0002';
  end if;
  if d.status <> 'proposed' then
    raise exception 'This draft was already %', d.status using errcode = 'P0001';
  end if;
  f := coalesce(p_fields, d.fields);
  rid := private.write_record(d.business_id, d.kind, f, d.capture_id, d.id);
  update public.record_drafts
  set status = 'confirmed', fields = f, confirmed_by = auth.uid(), confirmed_at = now(), record_id = rid
  where id = d.id;
  perform private.resolve_capture_if_done(d.capture_id);
  return rid;
end $$;

-- Hand entry (same validation path; TS validates the payload shape first).
create function public.record_entry(p_business_id uuid, p_kind public.record_kind, p_fields jsonb) returns uuid
language sql security invoker set search_path = '' as $$
  select private.write_record(p_business_id, p_kind, p_fields);
$$;
revoke execute on function public.record_entry(uuid, public.record_kind, jsonb) from public, anon;
grant execute on function public.record_entry(uuid, public.record_kind, jsonb) to authenticated;

-- Voiding keeps history intact (the audit log has the before/after) and reverses stock.
create function public.void_record(p_kind public.record_kind, p_id uuid, p_reason text default null) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  bid uuid;
begin
  if p_kind = 'sale' then
    update public.sales set voided_at = now(), notes = concat_ws(' · ', notes, 'Voided: ' || p_reason)
    where id = p_id and voided_at is null returning business_id into bid;
    if bid is not null then
      insert into public.stock_movements (business_id, product_id, quantity_delta, reason, notes, sale_id)
      select business_id, product_id, -quantity_delta, 'return', 'Reversal of voided sale', sale_id
      from public.stock_movements where sale_id = p_id and reason = 'sale';
    end if;
  elsif p_kind = 'expense' then
    update public.expenses set voided_at = now(), description = concat_ws(' · ', description, 'Voided: ' || p_reason)
    where id = p_id and voided_at is null returning business_id into bid;
  else
    raise exception 'Only sales and expenses can be voided' using errcode = 'P0001';
  end if;
  if bid is null then
    raise exception 'Record not found or already voided' using errcode = 'P0002';
  end if;
  perform private.emit_event(bid, p_kind::text || '.voided', p_kind::text, p_id, jsonb_build_object('reason', p_reason));
end $$;
revoke execute on function public.void_record(public.record_kind, uuid, text) from public, anon;
grant execute on function public.void_record(public.record_kind, uuid, text) to authenticated;

-- Period totals for dashboards (RLS applies: security invoker).
create function public.business_summary(p_business_id uuid, p_from timestamptz, p_to timestamptz)
returns table (
  sales_count int, sales_minor bigint, collected_minor bigint, receivable_minor bigint,
  expenses_minor bigint, net_minor bigint, customers_served int
)
language sql stable security invoker set search_path = '' as $$
  with s as (
    select count(*)::int n, coalesce(sum(total_minor), 0)::bigint total, coalesce(sum(amount_paid_minor), 0)::bigint paid,
           count(distinct customer_id)::int customers
    from public.sales
    where business_id = p_business_id and voided_at is null and occurred_at >= p_from and occurred_at < p_to
  ), e as (
    select coalesce(sum(amount_minor), 0)::bigint total from public.expenses
    where business_id = p_business_id and voided_at is null and occurred_at >= p_from and occurred_at < p_to
  )
  select s.n, s.total, s.paid, s.total - s.paid, e.total, s.total - e.total, s.customers from s, e;
$$;
grant execute on function public.business_summary(uuid, timestamptz, timestamptz) to authenticated;
