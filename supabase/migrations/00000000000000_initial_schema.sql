-- Hark initial schema
-- Derived from avent-ridge's live database via Supabase REST OpenAPI introspection
-- (table/column/type/default/nullability) cross-referenced with avent-ridge's
-- version-controlled migration files (constraints, indexes, RLS, functions) where available.
--
-- KNOWN GAPS (tables below only had introspected column data, no version-controlled
-- migration existed for them): users, wallets, assets, deposits, withdrawals,
-- transactions, portfolio, holdings, kyc, push_subscriptions, verification_codes, settings.
-- Foreign keys on those tables are INFERRED from naming convention (e.g. user_id -> users.id)
-- and cross-checked against app code usage, not copied from a real constraint — verify
-- against the avent-ridge database if exact referential behavior matters.
--
-- RLS policies below were derived from actually tracing every `.from(table)` call in
-- avent-ridge's API routes to see whether it used the session (RLS-bound) client or the
-- service-role client (which bypasses RLS) — an earlier version of this file wrongly
-- assumed "no migration file" meant "service-role only", which broke KYC submission,
-- wallet reads, deposits, transactions, and admin role checks throughout the app.
--
-- All admin-check policies use public.is_admin(), a security definer function, rather
-- than an inline `exists (select ... from public.users where role = 'admin')`. The
-- inline form causes "infinite recursion detected in policy for relation users" once
-- public.users itself has an admin policy, because evaluating that policy requires
-- re-querying public.users, which re-triggers the same policy. security definer bypasses
-- RLS for the function's internal query, breaking the cycle.

create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- =========================================================================
-- users (mirrors auth.users; id is the Supabase auth user id, no default)
-- =========================================================================
create table if not exists public.users (
  id uuid primary key,
  email text,
  phone text,
  name text,
  role text default 'buyer',
  status text default 'active',
  email_verified boolean default false,
  phone_verified boolean default false,
  plain_password text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.users enable row level security;
drop policy if exists "Users view own profile" on public.users;
create policy "Users view own profile" on public.users
  for select using (auth.uid() = id);
drop policy if exists "Users update own profile" on public.users;
create policy "Users update own profile" on public.users
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- security definer: bypasses RLS internally, breaking the recursion that
-- would otherwise occur when a policy on public.users checks admin status
-- by querying public.users itself.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.users where id = auth.uid() and role = 'admin'
  );
$$;

drop policy if exists "Admins full access to users" on public.users;
create policy "Admins full access to users" on public.users
  for all using (
    public.is_admin()
  );

-- =========================================================================
-- wallets
-- =========================================================================
create table if not exists public.wallets (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  currency text not null default 'USD',
  main_balance numeric default 0,
  available_balance numeric default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_wallets_user on public.wallets(user_id);
alter table public.wallets enable row level security;
drop policy if exists "Users manage own wallets" on public.wallets;
create policy "Users manage own wallets" on public.wallets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Admins full access to wallets" on public.wallets;
create policy "Admins full access to wallets" on public.wallets
  for all using (
    public.is_admin()
  );

-- =========================================================================
-- assets
-- =========================================================================
create table if not exists public.assets (
  id uuid primary key default uuid_generate_v4(),
  symbol text not null,
  name text not null,
  type text not null,
  price numeric default 0,
  change_percent numeric default 0,
  logo_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.assets enable row level security;
drop policy if exists "Admins full access to assets" on public.assets;
create policy "Admins full access to assets" on public.assets
  for all using (
    public.is_admin()
  );

-- =========================================================================
-- deposits
-- =========================================================================
create table if not exists public.deposits (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  user_email text not null,
  amount numeric not null,
  currency text not null,
  address text not null,
  receipt_url text not null,
  tx_hash text,
  status text default 'pending',
  rejection_reason text,
  wallet_type text default 'trading',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_deposits_user on public.deposits(user_id);
alter table public.deposits enable row level security;
drop policy if exists "Users manage own deposits" on public.deposits;
create policy "Users manage own deposits" on public.deposits
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Admins full access to deposits" on public.deposits;
create policy "Admins full access to deposits" on public.deposits
  for all using (
    public.is_admin()
  );

-- =========================================================================
-- withdrawals
-- =========================================================================
create table if not exists public.withdrawals (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  wallet_id uuid not null references public.wallets(id) on delete cascade,
  amount numeric not null,
  currency text not null,
  network text not null,
  address text not null,
  status text not null default 'pending',
  admin_feedback text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_withdrawals_user on public.withdrawals(user_id);
alter table public.withdrawals enable row level security;

-- =========================================================================
-- transactions
-- =========================================================================
create table if not exists public.transactions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  asset_id uuid references public.assets(id),
  symbol text not null,
  type text not null,
  amount numeric not null,
  price numeric not null,
  total_value numeric not null,
  status text default 'completed',
  description text,
  created_at timestamptz default now()
);
create index if not exists idx_transactions_user on public.transactions(user_id);
alter table public.transactions enable row level security;
drop policy if exists "Users manage own transactions" on public.transactions;
create policy "Users manage own transactions" on public.transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Admins full access to transactions" on public.transactions;
create policy "Admins full access to transactions" on public.transactions
  for all using (
    public.is_admin()
  );

-- =========================================================================
-- portfolio
-- =========================================================================
create table if not exists public.portfolio (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  asset_id uuid references public.assets(id),
  symbol text not null,
  amount numeric default 0,
  average_price numeric default 0,
  current_value numeric default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_portfolio_user on public.portfolio(user_id);
alter table public.portfolio enable row level security;

-- =========================================================================
-- holdings
-- =========================================================================
create table if not exists public.holdings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  asset_symbol text not null,
  asset_name text not null,
  asset_type text not null,
  quantity numeric not null default 0,
  avg_buy_price numeric not null default 0,
  total_invested numeric not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_holdings_user on public.holdings(user_id);
alter table public.holdings enable row level security;

-- =========================================================================
-- kyc
-- =========================================================================
create table if not exists public.kyc (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  user_email text not null,
  first_name text not null,
  last_name text not null,
  date_of_birth date,
  phone text,
  address text,
  city text,
  state text,
  country text,
  postal_code text,
  id_type text not null,
  id_number text not null,
  id_front_image text,
  id_back_image text,
  selfie_image text,
  status text default 'pending',
  rejection_reason text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_kyc_user on public.kyc(user_id);
alter table public.kyc enable row level security;
drop policy if exists "Users manage own kyc" on public.kyc;
create policy "Users manage own kyc" on public.kyc
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Admins full access to kyc" on public.kyc;
create policy "Admins full access to kyc" on public.kyc
  for all using (
    public.is_admin()
  );

-- =========================================================================
-- push_subscriptions
-- =========================================================================
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh_key text not null,
  auth_key text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_push_subscriptions_user on public.push_subscriptions(user_id);
alter table public.push_subscriptions enable row level security;

-- =========================================================================
-- verification_codes
-- =========================================================================
create table if not exists public.verification_codes (
  id uuid primary key default uuid_generate_v4(),
  email text not null unique,
  code text not null,
  expires_at timestamptz not null,
  created_at timestamptz default now()
);
alter table public.verification_codes enable row level security;

-- =========================================================================
-- settings (generic key/value, jsonb value)
-- =========================================================================
create table if not exists public.settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz default now()
);
alter table public.settings enable row level security;
drop policy if exists "Authenticated users can read settings" on public.settings;
create policy "Authenticated users can read settings" on public.settings
  for select to authenticated using (true);

-- Seed with empty placeholder addresses (NOT avent-ridge's real wallets — those
-- are a different business's receiving addresses) so the admin "Deposit Wallet
-- Addresses" editor has rows to populate. Fill in real addresses via the admin
-- Settings tab before enabling deposits for real users.
insert into public.settings (key, description, value) values (
  'deposit_methods',
  'Crypto wallet addresses shown to users on the deposit page',
  '[
    {"id":"btc","name":"Bitcoin","symbol":"BTC","address":"","qrCode":"","network":"Bitcoin"},
    {"id":"usdt","name":"USDT (Tron)","symbol":"USDT","address":"","qrCode":"","network":"TRC-20"}
  ]'::jsonb
) on conflict (key) do nothing;

-- =========================================================================
-- site_settings (from supabase/migrations/site_settings.sql)
-- =========================================================================
create table if not exists public.site_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz default now()
);
insert into public.site_settings (key, value)
values ('ai_trade_mode', 'normal')
on conflict (key) do nothing;
alter table public.site_settings enable row level security;
-- No public access — server-side only via service role, matching original.

-- =========================================================================
-- ai_trades (from ai_trades_setup.sql + ai_trades_update.sql + add_duration.sql, merged)
-- =========================================================================
create table if not exists public.ai_trades (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  stake numeric not null check (stake > 0),
  direction text not null check (direction in ('UP', 'DOWN')),
  outcome text not null check (outcome in ('WIN', 'LOSS')),
  status text not null default 'pending' check (status in ('pending', 'resolved', 'expired')),
  profit numeric default 0,
  duration integer default 60,
  resolves_at timestamptz,
  entry_price numeric default 0,
  created_at timestamptz default now(),
  resolved_at timestamptz
);
create index if not exists idx_ai_trades_user_status on public.ai_trades(user_id, status);
create index if not exists idx_ai_trades_created on public.ai_trades(created_at);
create unique index if not exists idx_ai_trades_one_pending
  on public.ai_trades(user_id) where status = 'pending';

alter table public.ai_trades enable row level security;
drop policy if exists "Users view own ai trades" on public.ai_trades;
create policy "Users view own ai trades" on public.ai_trades
  for select using (auth.uid() = user_id);
drop policy if exists "Admins full ai trades access" on public.ai_trades;
create policy "Admins full ai trades access" on public.ai_trades
  for all using (
    public.is_admin()
  );

-- =========================================================================
-- managed_trades + managed_trade_stakes (from managed_trades_setup.sql
-- + add_user_ends_at_to_stakes.sql, merged)
-- =========================================================================
create table if not exists public.managed_trades (
  id uuid default gen_random_uuid() primary key,
  asset_symbol text not null,
  asset_name text not null,
  asset_type text not null,
  profit_percent numeric not null,
  min_stake numeric not null default 10,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  scope text not null default 'all',
  target_user_id uuid references public.users(id) on delete cascade,
  status text not null default 'active',
  signal_type text,
  entry_price numeric,
  duration text,
  outcome text default 'win',
  created_by uuid references public.users(id) not null,
  created_at timestamptz default now()
);
alter table public.managed_trades enable row level security;
drop policy if exists "Users view relevant trades" on public.managed_trades;
create policy "Users view relevant trades" on public.managed_trades
  for select using (true);
drop policy if exists "Admins full access to managed_trades" on public.managed_trades;
create policy "Admins full access to managed_trades" on public.managed_trades
  for all using (
    public.is_admin()
  );

create table if not exists public.managed_trade_stakes (
  id uuid default gen_random_uuid() primary key,
  trade_id uuid references public.managed_trades(id) on delete cascade not null,
  user_id uuid references public.users(id) on delete cascade not null,
  stake_amount numeric not null,
  profit_amount numeric,
  direction text not null default 'call',
  status text not null default 'active',
  entry_price numeric default 0,
  created_at timestamptz default now(),
  paid_out_at timestamptz,
  ends_at timestamptz,
  user_ends_at timestamptz,
  unique(trade_id, user_id)
);
alter table public.managed_trade_stakes enable row level security;
drop policy if exists "Users view own stakes" on public.managed_trade_stakes;
create policy "Users view own stakes" on public.managed_trade_stakes
  for select using (auth.uid() = user_id);
drop policy if exists "Admins full access to managed_trade_stakes" on public.managed_trade_stakes;
create policy "Admins full access to managed_trade_stakes" on public.managed_trade_stakes
  for all using (
    public.is_admin()
  );

-- =========================================================================
-- support_conversations + support_messages + help_articles
-- (from supabase/migrations/support.sql, verbatim incl. seed data)
-- =========================================================================
create table if not exists public.support_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  subject text default 'Support Request',
  status text not null default 'open',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.support_conversations(id) on delete cascade,
  sender_id uuid references public.users(id),
  sender_role text not null,
  body text not null,
  created_at timestamptz default now()
);

create table if not exists public.help_articles (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  title text not null,
  body text not null,
  is_published boolean default true,
  sort_order int default 0,
  created_at timestamptz default now()
);

alter table public.support_conversations enable row level security;
alter table public.support_messages enable row level security;
alter table public.help_articles enable row level security;

drop policy if exists "Users can view own conversations" on public.support_conversations;
create policy "Users can view own conversations"
  on public.support_conversations for select
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Users can insert own conversations" on public.support_conversations;
create policy "Users can insert own conversations"
  on public.support_conversations for insert
  with check (user_id = auth.uid());

drop policy if exists "Admins can update conversations" on public.support_conversations;
create policy "Admins can update conversations"
  on public.support_conversations for update
  using (public.is_admin() or user_id = auth.uid());

drop policy if exists "Users can view messages in own conversations" on public.support_messages;
create policy "Users can view messages in own conversations"
  on public.support_messages for select
  using (
    exists (
      select 1 from public.support_conversations
      where id = conversation_id
      and (user_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists "Users/admins can send messages" on public.support_messages;
create policy "Users/admins can send messages"
  on public.support_messages for insert
  with check (sender_id = auth.uid());

drop policy if exists "Authenticated users can read help articles" on public.help_articles;
create policy "Authenticated users can read help articles"
  on public.help_articles for select
  to authenticated
  using (is_published = true);

drop policy if exists "Admins can manage help articles" on public.help_articles;
create policy "Admins can manage help articles"
  on public.help_articles for all
  using (public.is_admin());

insert into public.help_articles (category, title, body, sort_order) values
  ('getting-started', 'How do I create an account?', 'To create an account, visit our sign-up page and enter your full name, email address, and a secure password. You will receive a verification code by email to confirm your identity.', 1),
  ('getting-started', 'How do I verify my identity (KYC)?', 'Go to Profile → KYC Verification and follow the steps to submit your government-issued ID. Our team reviews submissions within 1-3 business days.', 2),
  ('getting-started', 'What currencies are supported?', 'We support deposits and withdrawals in USD via bank transfer or crypto. Contact support if you need help with a specific currency.', 3),
  ('trading', 'How does Live Trading (AI) work?', 'Live Trading uses an AI signal engine to determine trade outcomes. You select an asset, enter an amount, and choose Call (price goes up) or Put (price goes down). Trades resolve in your chosen time frame.', 1),
  ('trading', 'What is Broker Trading?', 'Broker Trading (formerly Live Trading) gives you access to managed signal trades curated by expert analysts. When an active signal is available for your chosen asset, you can enter the position.', 2),
  ('trading', 'How are trade profits calculated?', 'Profit is calculated as: Stake × Profit% / 100. For example, a $100 trade with 85% profit returns $85 on a win — total payout $185.', 3),
  ('deposits', 'How do I deposit funds?', 'Go to Wallet → Deposit. Select your preferred method (e.g. crypto or bank transfer) and follow the on-screen instructions. Your balance updates once the payment is confirmed.', 1),
  ('deposits', 'How long do deposits take?', 'Crypto deposits are usually confirmed within 10-30 minutes. Bank transfers may take 1-3 business days depending on your bank.', 2),
  ('deposits', 'How do I withdraw my funds?', 'Go to Wallet → Withdraw, enter the amount and destination details, then submit. Withdrawals are reviewed and processed within 1-2 business days.', 3),
  ('account', 'How do I change my password?', 'For security, passwords are linked to your email. If you need a reset, use the "Forgot Password" option on the login page.', 1),
  ('account', 'How do I update my profile name?', 'Go to Profile and tap the "Edit" button at the top right. Update your name and tap Save.', 2),
  ('security', 'Is my data secure?', 'Yes. We use industry-standard encryption for all data at rest and in transit. Two-factor authentication via OTP is required for new account sign-ups.', 1),
  ('security', 'I noticed suspicious activity on my account. What should I do?', 'Contact support immediately via Live Chat. We can temporarily suspend your account while we investigate.', 2)
on conflict do nothing;

-- =========================================================================
-- notifications (from supabase/migrations/20260319_create_notifications_table.sql)
-- =========================================================================
create table if not exists public.notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  body text not null,
  url text,
  is_read boolean default false,
  created_at timestamptz default now()
);
alter table public.notifications enable row level security;
drop policy if exists "Users can view their own notifications" on public.notifications;
create policy "Users can view their own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);
drop policy if exists "Users can update their own notifications" on public.notifications;
create policy "Users can update their own notifications"
  on public.notifications for update
  using (auth.uid() = user_id);
drop policy if exists "Admins can manage all notifications" on public.notifications;
create policy "Admins can manage all notifications"
  on public.notifications for all
  using (
    public.is_admin()
  );

-- =========================================================================
-- adjust_wallet_balance function
-- (from supabase/migrations/adjust_wallet_balance.sql, verbatim)
-- =========================================================================
create or replace function adjust_wallet_balance(
  p_user_id uuid,
  p_currency text,
  p_amount numeric
)
returns void as $$
begin
  update public.wallets
  set
    main_balance = main_balance + p_amount,
    available_balance = available_balance + p_amount
  where user_id = p_user_id
    and currency = p_currency;

  if not found then
    raise exception 'Wallet not found for user % with currency %', p_user_id, p_currency;
  end if;
end;
$$ language plpgsql;
