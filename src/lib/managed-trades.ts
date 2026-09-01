import { supabaseAdmin } from "./supabase-server";

export async function processTradePayout(tradeId: string) {
  // 1. Fetch trade
  const { data: trade, error: tradeErr } = await supabaseAdmin
    .from("managed_trades")
    .select("*")
    .eq("id", tradeId)
    .single();

  if (tradeErr || !trade) throw new Error("Trade not found");
  if (trade.status !== "active") throw new Error("Trade is not active");

  // 2. Fetch all active positions for this signal
  const { data: userPositions, error: userPositionsErr } = await supabaseAdmin
    .from("managed_trade_stakes")
    .select("*")
    .eq("trade_id", tradeId)
    .eq("status", "active");

  if (userPositionsErr) throw userPositionsErr;

  const results = {
    totalTraders: userPositions?.length || 0,
    paidOut: 0,
    failed: 0
  };

  if (!userPositions || userPositions.length === 0) {
    // No traders, just mark trade as completed
    await supabaseAdmin
      .from("managed_trades")
      .update({ status: "completed" })
      .eq("id", tradeId);
    return results;
  }

  // 3. Process each trade position
  for (const tradePosition of userPositions) {
    try {
      // Determine if the user wins
      let isWin = false;
      if (trade.target_user_id) {
        // Targeted trade: only the target user wins
        isWin = tradePosition.user_id === trade.target_user_id;
      } else {
        // Global trade: use signal type and outcome
        const marketDirection = trade.signal_type === 'call' 
          ? (trade.outcome === 'win' ? 'call' : 'put')
          : (trade.outcome === 'win' ? 'put' : 'call');

        isWin = tradePosition.direction === marketDirection;
      }

      const tradeAmount = Number(tradePosition.stake_amount);
      const profitAmount = isWin ? (tradeAmount * Number(trade.profit_percent)) / 100 : 0;
      const totalPayout = isWin ? tradeAmount + profitAmount : 0;

      if (isWin) {
        // Credit user's wallet atomically
        const { error: walletErr } = await supabaseAdmin.rpc("adjust_wallet_balance", {
          p_user_id: tradePosition.user_id,
          p_currency: "trading",
          p_amount: totalPayout,
        });

        if (walletErr) {
          console.error(`Failed to credit wallet for user ${tradePosition.user_id}:`, walletErr);
          throw walletErr;
        }

        // Log transaction
        const { error: txError } = await supabaseAdmin.from("transactions").insert({
          user_id: tradePosition.user_id,
          amount: totalPayout,
          total_value: totalPayout,
          type: "managed_trade_payout",
          symbol: trade.asset_symbol,
          price: tradePosition.entry_price || trade.entry_price || 0,
          status: "completed"
        });

        if (txError) {
          console.error(`Failed to log payout transaction for user ${tradePosition.user_id}:`, txError);
        }
      }

      // Mark position as processed (paid_out if win, lost if loss)
      await supabaseAdmin
        .from("managed_trade_stakes")
        .update({ 
          status: isWin ? "paid_out" : "lost",
          paid_out_at: new Date().toISOString()
        })
        .eq("id", tradePosition.id);

      if (!isWin) {
        // Log loss transaction
        const { error: txError } = await supabaseAdmin.from("transactions").insert({
          user_id: tradePosition.user_id,
          amount: 0,
          total_value: tradeAmount,
          type: "managed_trade_loss",
          symbol: trade.asset_symbol,
          price: tradePosition.entry_price || trade.entry_price || 0,
          status: "completed"
        });

        if (txError) {
          console.error(`Failed to log loss transaction for user ${tradePosition.user_id}:`, txError);
        }
      }

      // 4. Notify User
      try {
        const { sendPushNotification } = await import("./push-notifications");
        await sendPushNotification(tradePosition.user_id, {
          title: isWin ? "Trade Payout Received" : "Trade Result: Loss",
          body: isWin 
            ? `Your $${tradeAmount.toLocaleString()} trade in ${trade.asset_symbol} has matured! $${totalPayout.toLocaleString()} has been credited to your trading wallet.`
            : `Your $${tradeAmount.toLocaleString()} trade in ${trade.asset_symbol} managed trade has expired in a loss.`,
          url: "/wallet"
        });
      } catch (pushErr) {
        console.error("Failed to send payout notification:", pushErr);
      }

      results.paidOut++;
    } catch (e) {
      console.error(`Failed to process position ${tradePosition.id}:`, e);
      results.failed++;
    }
  }

  // 4. Mark trade as completed
  await supabaseAdmin
    .from("managed_trades")
    .update({ status: "completed" })
    .eq("id", tradeId);

  return results;
}
