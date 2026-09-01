-- 1. Reset balances (just in case)
UPDATE public.wallets 
SET main_balance = 0, available_balance = 0;

-- 2. Optional: If you want to force the existing users to transition to the new wallets
-- you can delete their existing ones, and the API will recreate 'trading' and 'holding' wallets upon login.
-- **Warning: This removes all wallet records**
-- DELETE FROM public.wallets;

-- 3. Delete all transaction history
DELETE FROM public.transactions;

-- 4. Delete all portfolio holdings
DELETE FROM public.portfolio;

-- 5. Delete all pending/completed deposits
DELETE FROM public.deposits;
