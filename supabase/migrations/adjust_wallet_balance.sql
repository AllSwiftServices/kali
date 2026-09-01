-- Atomic wallet balance adjustment function
-- Run this in your Supabase SQL Editor to enable race-condition-safe wallet updates

CREATE OR REPLACE FUNCTION adjust_wallet_balance(
  p_user_id UUID,
  p_currency TEXT,
  p_amount NUMERIC
)
RETURNS VOID AS $$
BEGIN
  UPDATE wallets
  SET 
    main_balance = main_balance + p_amount,
    available_balance = available_balance + p_amount
  WHERE user_id = p_user_id
    AND currency = p_currency;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet not found for user % with currency %', p_user_id, p_currency;
  END IF;
END;
$$ LANGUAGE plpgsql;
