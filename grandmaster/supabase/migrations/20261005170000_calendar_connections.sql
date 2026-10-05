-- Calendar connections for Upshot (grandmaster/sops/calendar-from-sign-in.md).
-- One row per user and provider. refresh_token is the provider's OAuth
-- refresh token, AES-GCM encrypted by the Worker (CALENDAR_TOKEN_KEY), so a
-- database leak alone gives no calendar access.
--
-- RLS is on with no policies: only the Worker's secret key reads or writes
-- (supabase.com/docs/guides/database/postgres/row-level-security). Rows go
-- away with the account (on delete cascade).

create table public.calendar_connections (
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null check (provider in ('google', 'azure')),
  email text,
  refresh_token text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, provider)
);

alter table public.calendar_connections enable row level security;

revoke all on public.calendar_connections from anon, authenticated;
