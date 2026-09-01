-- Fix: "infinite recursion detected in policy for relation users" — every
-- admin-check policy in the schema (including the two I just added on
-- public.users itself) checks admin status with:
--
--   exists (select 1 from public.users where id = auth.uid() and role = 'admin')
--
-- That's fine on tables OTHER than users. But once public.users itself has
-- an admin policy using this pattern, evaluating it requires re-querying
-- public.users, which re-triggers the same policy — infinite recursion.
-- This is why /api/users, /api/wallets, /api/managed-trades, /api/deposits,
-- and /api/kyc were all failing (403s and 500s) for the admin account.
--
-- Fix: a security definer function bypasses RLS for its own internal
-- query, breaking the cycle. Replace every inline admin-check with it.

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

-- users
drop policy if exists "Admins full access to users" on public.users;
create policy "Admins full access to users" on public.users
  for all using (public.is_admin());

-- wallets
drop policy if exists "Admins full access to wallets" on public.wallets;
create policy "Admins full access to wallets" on public.wallets
  for all using (public.is_admin());

-- assets
drop policy if exists "Admins full access to assets" on public.assets;
create policy "Admins full access to assets" on public.assets
  for all using (public.is_admin());

-- deposits
drop policy if exists "Admins full access to deposits" on public.deposits;
create policy "Admins full access to deposits" on public.deposits
  for all using (public.is_admin());

-- transactions
drop policy if exists "Admins full access to transactions" on public.transactions;
create policy "Admins full access to transactions" on public.transactions
  for all using (public.is_admin());

-- kyc
drop policy if exists "Admins full access to kyc" on public.kyc;
create policy "Admins full access to kyc" on public.kyc
  for all using (public.is_admin());

-- ai_trades (pre-existing policy, same recursive pattern)
drop policy if exists "Admins full ai trades access" on public.ai_trades;
create policy "Admins full ai trades access" on public.ai_trades
  for all using (public.is_admin());

-- managed_trades (pre-existing policy, same recursive pattern)
drop policy if exists "Admins full access to managed_trades" on public.managed_trades;
create policy "Admins full access to managed_trades" on public.managed_trades
  for all using (public.is_admin());

-- managed_trade_stakes (pre-existing policy, same recursive pattern)
drop policy if exists "Admins full access to managed_trade_stakes" on public.managed_trade_stakes;
create policy "Admins full access to managed_trade_stakes" on public.managed_trade_stakes
  for all using (public.is_admin());

-- support_conversations (pre-existing policies, same recursive pattern)
drop policy if exists "Users can view own conversations" on public.support_conversations;
create policy "Users can view own conversations"
  on public.support_conversations for select
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Admins can update conversations" on public.support_conversations;
create policy "Admins can update conversations"
  on public.support_conversations for update
  using (public.is_admin() or user_id = auth.uid());

-- support_messages (pre-existing policy, same recursive pattern)
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

-- help_articles (pre-existing policy, same recursive pattern)
drop policy if exists "Admins can manage help articles" on public.help_articles;
create policy "Admins can manage help articles"
  on public.help_articles for all
  using (public.is_admin());

-- notifications (pre-existing policy, same recursive pattern)
drop policy if exists "Admins can manage all notifications" on public.notifications;
create policy "Admins can manage all notifications"
  on public.notifications for all
  using (public.is_admin());
