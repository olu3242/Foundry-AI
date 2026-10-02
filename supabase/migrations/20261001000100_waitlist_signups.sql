create table public.waitlist_signups (
  id            uuid primary key default gen_random_uuid(),
  role          text not null check (role in (
    'Business owner', 'Program / bank / sponsor', 'Partner', 'Business Partner applicant', 'Other'
  )),
  contact       text not null check (char_length(contact) between 7 and 254),
  contact_hash  text not null unique check (contact_hash ~ '^[a-f0-9]{64}$'),
  country       text check (country is null or char_length(country) <= 80),
  consented_at  timestamptz not null,
  created_at    timestamptz not null default now()
);

create index waitlist_signups_created_at_idx on public.waitlist_signups (created_at desc);

alter table public.waitlist_signups enable row level security;
revoke all on table public.waitlist_signups from public, anon, authenticated;
grant insert on table public.waitlist_signups to service_role;