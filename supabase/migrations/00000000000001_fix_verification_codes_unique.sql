-- Fix: upsert(..., { onConflict: 'email' }) in send-otp/route.ts requires a
-- unique constraint on email, not just a plain index.
drop index if exists public.idx_verification_codes_email;
alter table public.verification_codes
  add constraint verification_codes_email_key unique (email);
