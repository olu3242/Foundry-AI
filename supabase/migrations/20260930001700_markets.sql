-- B19 Multi-market: every market is configuration (no forks). Reuses all prior business logic;
-- countries differ in currency, timezone, language, identifiers, jurisdiction rules, connectors
-- and data residency.

create table public.markets (
  country_code      text primary key check (country_code ~ '^[A-Z]{2}$'),
  name              text not null,
  currency          text not null check (currency ~ '^[A-Z]{3}$'),
  default_timezone  text not null,
  default_locale    text not null default 'en',
  languages         text[] not null default array['en'],
  phone_prefix      text not null check (phone_prefix ~ '^[0-9]{1,4}$'),
  address_format    jsonb not null default '["line1", "city", "region"]',
  identifier_types  jsonb not null default '[]',
  jurisdiction      jsonb not null default '{}',
  connectors        jsonb not null default '{}',
  data_residency    text not null default 'any',
  status            text not null default 'active' check (status in ('active', 'beta', 'disabled')),
  updated_at        timestamptz not null default now()
);

insert into public.markets (country_code, name, currency, default_timezone, default_locale, languages, phone_prefix, identifier_types, jurisdiction, connectors) values
  ('NG', 'Nigeria', 'NGN', 'Africa/Lagos', 'en', array['en', 'yo', 'ha', 'ig', 'pcm'], '234',
   '[{"key":"cac_rc","label":"CAC registration (RC/BN)","pattern":"^(RC|BN)?[0-9]{5,8}$"},{"key":"tin","label":"Tax ID (TIN)","pattern":"^[0-9]{8,12}(-[0-9]{4})?$"}]',
   '{"vat_rate":0.075,"data_protection":"NDPA 2023"}', '{"mobile_money":["OPay","PalmPay","Moniepoint","MTN MoMo PSB"]}'),
  ('GH', 'Ghana', 'GHS', 'Africa/Accra', 'en', array['en', 'tw', 'ee'], '233',
   '[{"key":"ghana_card","label":"Ghana Card / TIN","pattern":"^GHA-[0-9]{9}-[0-9]$"},{"key":"orc","label":"ORC registration","pattern":"^[A-Z]{2}[0-9]{6,12}$"}]',
   '{"vat_rate":0.15,"data_protection":"Data Protection Act 2012"}', '{"mobile_money":["MTN MoMo","Telecel Cash","AirtelTigo Money"]}'),
  ('KE', 'Kenya', 'KES', 'Africa/Nairobi', 'en', array['en', 'sw'], '254',
   '[{"key":"kra_pin","label":"KRA PIN","pattern":"^[AP][0-9]{9}[A-Z]$"}]',
   '{"vat_rate":0.16,"data_protection":"Data Protection Act 2019"}', '{"mobile_money":["M-Pesa","Airtel Money"]}'),
  ('ZA', 'South Africa', 'ZAR', 'Africa/Johannesburg', 'en', array['en', 'zu', 'xh', 'af'], '27',
   '[{"key":"cipc","label":"CIPC registration","pattern":"^[0-9]{4}/[0-9]{6}/[0-9]{2}$"}]',
   '{"vat_rate":0.15,"data_protection":"POPIA"}', '{"mobile_money":["MTN MoMo","Vodacom VodaPay"]}'),
  ('RW', 'Rwanda', 'RWF', 'Africa/Kigali', 'en', array['en', 'rw', 'fr'], '250',
   '[{"key":"rdb_tin","label":"RDB TIN","pattern":"^[0-9]{9}$"}]', '{"vat_rate":0.18}', '{"mobile_money":["MTN MoMo","Airtel Money"]}'),
  ('SN', 'Sénégal', 'XOF', 'Africa/Dakar', 'fr', array['fr', 'wo'], '221',
   '[{"key":"ninea","label":"NINEA","pattern":"^[0-9]{7,9}[A-Z0-9]{0,3}$"}]', '{"vat_rate":0.18}', '{"mobile_money":["Orange Money","Wave","Free Money"]}'),
  ('CI', 'Côte d''Ivoire', 'XOF', 'Africa/Abidjan', 'fr', array['fr'], '225',
   '[{"key":"rccm","label":"RCCM","pattern":"^CI-[A-Z]{3}-[0-9]{4}-[A-Z]-[0-9]{1,6}$"}]', '{"vat_rate":0.18}', '{"mobile_money":["Orange Money","MTN MoMo","Wave","Moov Money"]}');

alter table public.businesses
  add column locale text,
  add column address jsonb not null default '{}',
  add constraint businesses_market_fk foreign key (country_code) references public.markets (country_code);
update public.businesses b set locale = m.default_locale from public.markets m where m.country_code = b.country_code and b.locale is null;

-- Market defaults and residency on every new business (whichever path creates it).
create function private.apply_market() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  m public.markets;
  region text := coalesce(nullif(current_setting('app.data_region', true), ''), 'any');
begin
  select * into m from public.markets where country_code = new.country_code;
  if not found or m.status = 'disabled' then
    raise exception 'Foundry is not available in that country yet' using errcode = 'P0001';
  end if;
  if m.data_residency <> 'any' and region <> 'any' and m.data_residency <> region then
    raise exception 'Businesses in % must be stored in the % region', m.name, m.data_residency using errcode = 'P0001';
  end if;
  new.locale := coalesce(new.locale, m.default_locale);
  if tg_op = 'INSERT' then
    new.currency := m.currency;   -- the market decides the currency, not the client
    -- 'Africa/Lagos' is the historical column/RPC default: treat it as "not chosen".
    if new.timezone is null or new.timezone = 'Africa/Lagos' then
      new.timezone := m.default_timezone;
    end if;
  end if;
  return new;
end $$;
create trigger businesses_market before insert or update of country_code on public.businesses
  for each row execute function private.apply_market();

create table public.business_identifiers (
  business_id  uuid not null references public.businesses (id) on delete cascade,
  type         text not null,
  value        text not null check (char_length(value) between 2 and 60),
  verified     boolean not null default false,
  created_at   timestamptz not null default now(),
  primary key (business_id, type)
);

create function public.set_business_identifier(p_business_id uuid, p_type text, p_value text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  spec jsonb;
begin
  if not private.has_role(p_business_id, array['owner']::public.business_role[]) then
    raise exception 'Only the owner can add identifiers' using errcode = '42501';
  end if;
  select t into spec from public.businesses b join public.markets m on m.country_code = b.country_code,
    jsonb_array_elements(m.identifier_types) t
  where b.id = p_business_id and t ->> 'key' = p_type;
  if spec is null then
    raise exception 'That identifier is not used in this country' using errcode = 'P0001';
  end if;
  if upper(trim(p_value)) !~ (spec ->> 'pattern') then
    raise exception '% doesn''t look right. Check the format.', spec ->> 'label' using errcode = 'P0001';
  end if;
  insert into public.business_identifiers (business_id, type, value) values (p_business_id, p_type, upper(trim(p_value)))
  on conflict (business_id, type) do update set value = excluded.value, verified = false, created_at = now();
end $$;

create function public.upsert_market(p_market jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_platform_admin() then
    raise exception 'Platform admins only' using errcode = '42501';
  end if;
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

revoke execute on function public.set_business_identifier(uuid, text, text), public.upsert_market(jsonb) from public, anon;
grant execute on function public.set_business_identifier(uuid, text, text), public.upsert_market(jsonb) to authenticated;

alter table public.markets enable row level security;
alter table public.business_identifiers enable row level security;
create policy "markets: available" on public.markets for select to authenticated using (status <> 'disabled' or private.is_platform_admin());
create policy "identifiers: readers" on public.business_identifiers for select to authenticated using (private.can_read(business_id));
revoke insert, update, delete on public.markets, public.business_identifiers from authenticated;
grant update (locale, address) on public.businesses to authenticated;
