import { NextResponse } from "next/server";
import { createClient, supabaseAdmin } from "@/lib/supabase-server";

// POST /api/managed-trades/resolve-stake — Resolve a single user stake by ID
// Called client-side when the user's chosen expiration time elapses
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { stakeId } = await request.json();
    if (!stakeId) {
      return NextResponse.json({ error: "stakeId required" }, { status: 400 });
    }

    // Fetch the stake — must belong to this user and still be active
    const { data: stake, error: stakeErr } = await supabaseAdmin
      .from("managed_trade_stakes")
      .select("*, managed_trades(*)")
      .eq("id", stakeId)
      .eq("user_id", user.id)
      .single();

    if (stakeErr || !stake) {
      return NextResponse.json({ error: "Stake not found" }, { status: 404 });
    }
    const trade = stake.managed_trades;
    if (!trade) {
      return NextResponse.json({ error: "Trade not found" }, { status: 404 });
    }

    if (stake.status !== "active") {
      const isWin = stake.status === "paid_out";
      const tradeAmount = Number(stake.stake_amount);
      const profitPercent = trade.profit_percent ?? 80;
      const profitAmount = isWin ? (tradeAmount * Number(profitPercent)) / 100 : 0;
      const totalPayout = isWin ? tradeAmount + profitAmount : 0;

      return NextResponse.json({
        success: true,
        already_resolved: true,
        isWin,
        totalPayout,
        profitAmount,
        tradeAmount,
      });
    }

    // Determine win/loss based on admin's outcome setting
    const marketDirection = trade.signal_type === 'call'
      ? (trade.outcome === 'win' ? 'call' : 'put')
      : (trade.outcome === 'win' ? 'put' : 'call');

    const isWin = stake.direction === marketDirection;
    const tradeAmount = Number(stake.stake_amount);
    const profitAmount = isWin ? (tradeAmount * Number(trade.profit_percent)) / 100 : 0;
    const totalPayout = isWin ? tradeAmount + profitAmount : 0;

    if (isWin) {
      const { error: walletErr } = await supabaseAdmin.rpc("adjust_wallet_balance", {
        p_user_id: user.id,
        p_currency: "trading",
        p_amount: totalPayout,
      });

      if (walletErr) throw walletErr;

      // Log transaction
      await supabaseAdmin.from("transactions").insert({
        user_id: user.id,
        amount: totalPayout,
        total_value: totalPayout,
        type: "managed_trade_payout",
        symbol: trade.asset_symbol,
        price: stake.entry_price || trade.entry_price || 0,
        status: "completed"
      });
    } else {
      // Log loss
      await supabaseAdmin.from("transactions").insert({
        user_id: user.id,
        amount: 0,
        total_value: tradeAmount,
        type: "managed_trade_loss",
        symbol: trade.asset_symbol,
        price: stake.entry_price || trade.entry_price || 0,
        status: "completed"
      });
    }

    // Mark stake as resolved
    await supabaseAdmin
      .from("managed_trade_stakes")
      .update({
        status: isWin ? "paid_out" : "lost",
        paid_out_at: new Date().toISOString()
      })
      .eq("id", stakeId);

    // Push notification
    try {
      const { sendPushNotification } = await import("@/lib/push-notifications");
      await sendPushNotification(user.id, {
        title: isWin ? "Trade Payout! 🎉" : "Trade Expired",
        body: isWin
          ? `Your $${tradeAmount.toLocaleString()} trade won! $${totalPayout.toLocaleString()} credited to your wallet.`
          : `Your $${tradeAmount.toLocaleString()} trade expired in a loss.`,
        url: "/wallet"
      });
    } catch (e) { /* ignore */ }

    return NextResponse.json({
      success: true,
      isWin,
      totalPayout,
      profitAmount,
      tradeAmount,
    });
  } catch (error: any) {
    console.error("Resolve stake error:", error);
    return NextResponse.json({ message: error.message || "Failed to resolve stake" }, { status: 500 });
  }
}
