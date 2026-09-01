-- Fix: the previous policy patch gave users only "view/update own row" on
-- public.users, but admin actions on OTHER users (e.g. changing someone
-- else's role/status from the admin dashboard) also go through the session
-- client, not the service-role client. With no admin policy, the update
-- matched 0 rows under RLS, and .single() then failed with "Cannot coerce
-- the result to a single JSON object".
drop policy if exists "Admins full access to users" on public.users;
create policy "Admins full access to users" on public.users
  for all using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin')
  );
