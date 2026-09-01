import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: './.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  const { data: deps, error: depsError } = await supabase.from('deposits').select('*').order('created_at', { ascending: false }).limit(1);
  console.log("Latest deposit:", deps);
  
  if (deps && deps.length > 0) {
    const dep = deps[0];
    const { data: txs, error: txError } = await supabase.from('transactions').select('*').eq('user_id', dep.user_id);
    console.log("User transactions:", txs);
    console.log("Tx error:", txError);
    
    // Let's try to insert a transaction manually to see what error it gives
    const testTx = {
        user_id: dep.user_id,
        symbol: dep.currency === 'BTC' ? 'BTC' : 'USDT',
        type: 'deposit',
        amount: dep.amount,
        price: 1, 
        total_value: dep.amount,
        status: 'pending',
    };
    
    console.log("Attempting insert with service key:", testTx);
    const { data: inserted, error: insertError } = await supabase.from('transactions').insert(testTx).select();
    console.log("Inserted:", inserted);
    console.log("Insert error:", insertError);
  }
}
check();
