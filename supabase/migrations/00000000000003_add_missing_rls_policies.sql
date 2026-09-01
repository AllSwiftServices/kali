-- Fix: the initial schema assumed every table without a version-controlled
-- migration file was only ever touched via the service-role client (which
-- bypasses RLS). That assumption was wrong for users, wallets, deposits,
-- transactions, kyc, assets, and settings — the app reads/writes these
-- through the session (RLS-bound) client in several routes. With RLS
-- enabled and zero policies, Postgres denies everything by default, which
-- is why KYC submission failed and would have gone on to silently break
-- wallets, deposits, transactions, and admin role checks throughout the app.

-- users: needed for the many `.from("users").select("role").eq("id", user.id)`
-- role-checks scattered across API routes, and for self profile edits. This
-- is also foundational: every "admin full access" policy elsewhere in the
-- schema checks `exists (select ... from users where id = auth.uid() and
-- role = 'admin')`, which itself requires users to be selectable.
drop policy if exists "Users view own profile" on public.users;
create policy "Users view own profile" on public.users
  for select using (auth.uid() = id);
drop policy if exists "Users update own profile" on public.users;
create policy "Users update own profile" on public.users
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- wallets
drop policy if exists "Users manage own wallets" on public.wallets;
create policy "Users manage own wallets" on public.wallets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Admins full access to wallets" on public.wallets;
create policy "Admins full access to wallets" on public.wallets
  for all using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

-- assets (admin-managed catalog; browsing goes through the service role)
drop policy if exists "Admins full access to assets" on public.assets;
create policy "Admins full access to assets" on public.assets
  for all using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

-- deposits
drop policy if exists "Users manage own deposits" on public.deposits;
create policy "Users manage own deposits" on public.deposits
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Admins full access to deposits" on public.deposits;
create policy "Admins full access to deposits" on public.deposits
  for all using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

-- transactions
drop policy if exists "Users manage own transactions" on public.transactions;
create policy "Users manage own transactions" on public.transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Admins full access to transactions" on public.transactions;
create policy "Admins full access to transactions" on public.transactions
  for all using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

-- kyc (this is the policy fixing your current "row-level security" error)
drop policy if exists "Users manage own kyc" on public.kyc;
create policy "Users manage own kyc" on public.kyc
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Admins full access to kyc" on public.kyc;
create policy "Admins full access to kyc" on public.kyc
  for all using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

-- settings (read-only for regular users; writes go through the service role)
drop policy if exists "Authenticated users can read settings" on public.settings;
create policy "Authenticated users can read settings" on public.settings
  for select to authenticated using (true);
