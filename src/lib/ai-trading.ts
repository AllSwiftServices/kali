import { supabaseAdmin } from "./supabase-server";

export async function resolveAiTrade(tradeId: string) {
  // 1. Fetch the pending trade
  const { data: trade, error: tradeError } = await supabaseAdmin
    .from("ai_trades")
    .select("*")
    .eq("id", tradeId)
    .single();

  if (tradeError || !trade) throw new Error("Trade not found");
  if (trade.status !== "pending") throw new Error("Trade already resolved");

  // 2. Determine outcome and payout
  const isWin = trade.outcome === "WIN";
  const totalPayout = isWin ? trade.stake + trade.profit : 0;

  // 3. Mark trade as resolved
  const { error: updateTradeError } = await supabaseAdmin
    .from("ai_trades")
    .update({ 
      status: "resolved", 
      resolved_at: new Date().toISOString() 
    })
    .eq("id", tradeId);

  if (updateTradeError) throw updateTradeError;

  // 4. Record Transaction and Update Wallet if Win
  if (isWin) {
    // Record Win Transaction
    const { error: txError } = await supabaseAdmin.from("transactions").insert({
      user_id: trade.user_id,
      type: "trade_win",
      amount: totalPayout,
      symbol: "AI-PROFIT",
      price: trade.entry_price || 0,
      total_value: totalPayout,
      status: "completed"
    });

    if (txError) {
      console.error("Failed to insert win transaction:", txError);
    }

    // Update Wallet atomically
    const { error: walletErr } = await supabaseAdmin.rpc("adjust_wallet_balance", {
      p_user_id: trade.user_id,
      p_currency: "trading",
      p_amount: totalPayout,
    });

    if (walletErr) {
      console.error("Failed to update wallet on win:", walletErr);
    }
  } else {
    // Record Loss Transaction
    const { error: txError } = await supabaseAdmin.from("transactions").insert({
      user_id: trade.user_id,
      type: "trade_loss",
      amount: 0,
      symbol: "AI-LOSS",
      price: trade.entry_price || 0,
      total_value: trade.stake || 0,
      status: "completed"
    });

    if (txError) {
      console.error("Failed to insert loss transaction:", txError);
    }
  }

  return { outcome: trade.outcome, profit: trade.profit };
}
