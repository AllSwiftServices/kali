-- Create settings table
CREATE TABLE IF NOT EXISTS public.settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Allow read access to all authenticated users
CREATE POLICY "Allow read access to all authenticated users"
ON public.settings FOR SELECT
TO authenticated
USING (true);

-- Allow all access to service role (admin)
CREATE POLICY "Allow all access to service role"
ON public.settings FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Initial data for deposit methods
INSERT INTO public.settings (key, value, description)
VALUES (
    'deposit_methods',
    '[
        {
            "id": "btc",
            "name": "Bitcoin",
            "symbol": "BTC",
            "address": "bc1qer5t8hlnwg27slx2jr9qhw3qnqjjfaux9gcsmm",
            "qrCode": "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=bc1qer5t8hlnwg27slx2jr9qhw3qnqjjfaux9gcsmm",
            "network": "Bitcoin"
        },
        {
            "id": "usdt",
            "name": "USDT (Tron)",
            "symbol": "USDT",
            "address": "TFX2ktfJCDvdgLxt4di2AArfUKTnTQQ7yP",
            "qrCode": "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=TFX2ktfJCDvdgLxt4di2AArfUKTnTQQ7yP",
            "network": "TRC-20"
        }
    ]'::jsonb,
    'Configuration for available deposit methods'
) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
