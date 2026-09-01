
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkStuckTrades() {
  const { data, error } = await supabase
    .from('ai_trades')
    .select('id, user_id, status, created_at, resolves_at, duration')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Pending Trades:', JSON.stringify(data, null, 2));
}

checkStuckTrades();
