SELECT id, created_at, resolves_at, duration, status FROM ai_trades WHERE status = 'pending' ORDER BY created_at DESC LIMIT 5;
