-- Fix: two more upsert(..., { onConflict: '<col>' }) calls in the app need
-- unique constraints that the initial schema was missing.

-- kyc/route.ts: upsert(..., { onConflict: 'user_id' })
alter table public.kyc
  add constraint kyc_user_id_key unique (user_id);

-- notifications/subscribe/route.ts: upsert(..., { onConflict: 'endpoint' })
alter table public.push_subscriptions
  add constraint push_subscriptions_endpoint_key unique (endpoint);
