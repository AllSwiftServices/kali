import { NextResponse } from "next/server";
import { createClient, supabaseAdmin } from "@/lib/supabase-server";

// POST /api/managed-trades/[id]/enter — User enters a trade
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = (await params).id;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tradeId = id;
    const body = await request.json();
    const { amount, direction = "call", user_duration } = body;

    // Parse user-selected duration into milliseconds
    const durationMs: Record<string, number> = {
      '30s': 30_000, '1m': 60_000, '2m': 120_000, '3m': 180_000,
      '5m': 300_000, '10m': 600_000, '15m': 900_000, '20m': 1_200_000,
      '30m': 1_800_000, '45m': 2_700_000, '1h': 3_600_000,
      '2h': 7_200_000, '4h': 14_400_000, '6h': 21_600_000,
      '12h': 43_200_000, '24h': 86_400_000,
    };
    const userEndsAt = user_duration && durationMs[user_duration]
      ? new Date(Date.now() + durationMs[user_duration]).toISOString()
      : null;

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Invalid trade amount" }, { status: 400 });
    }

    if (!['call', 'put'].includes(direction)) {
      return NextResponse.json({ error: "Invalid trade direction" }, { status: 400 });
    }

    // 1. Fetch trade details and check validity
    const { data: trade, error: tradeErr } = await supabaseAdmin
      .from("managed_trades")
      .select("*")
      .eq("id", tradeId)
      .single();

    if (tradeErr || !trade) {
      return NextResponse.json({ error: "Trade not found" }, { status: 404 });
    }

    if (trade.status !== "active") {
      return NextResponse.json({ error: "Trade is no longer active" }, { status: 400 });
    }

    if (new Date(trade.ends_at) <= new Date()) {
      return NextResponse.json({ error: "Trade has expired" }, { status: 400 });
    }

    if (amount < trade.min_stake) {
      return NextResponse.json({ error: `Minimum amount is $${trade.min_stake}` }, { status: 400 });
    }

    // Check if user is eligible (if scoped to user)
    // Note: Admin wants targeted trades to be joinable by others but onlyPayout target_user_id.
    // So we no longer block entry for non-target users here.

    // 2. Fetch current asset price
    const { data: assetData, error: assetErr } = await supabaseAdmin
      .from("assets")
      .select("price")
      .eq("symbol", trade.asset_symbol)
      .single();

    const currentPrice = assetData ? assetData.price : 0;

    // 3. Check user trading balance
    const { data: wallet, error: walletErr } = await supabaseAdmin
      .from("wallets")
      .select("*")
      .eq("user_id", user.id)
      .eq("currency", "trading")
      .single();
 
    if (walletErr || !wallet || Number(wallet.main_balance) < amount) {
      return NextResponse.json({ error: "Insufficient trading balance" }, { status: 400 });
    }

    // 4. Perform transaction: Deduct balance atomically + Create trade position
    const { error: deductErr } = await supabaseAdmin.rpc("adjust_wallet_balance", {
      p_user_id: user.id,
      p_currency: "trading",
      p_amount: -amount,
    });

    if (deductErr) throw deductErr;

    const { data: tradeEntry, error: tradeEntryErr } = await supabaseAdmin
      .from("managed_trade_stakes")
      .insert({
        trade_id: tradeId,
        user_id: user.id,
        stake_amount: amount,
        direction,
        entry_price: currentPrice,
        ...(userEndsAt ? { user_ends_at: userEndsAt } : {}),
      })
      .select()
      .single();

    if (tradeEntryErr) {
      // Rollback balance atomically if record fails
      await supabaseAdmin.rpc("adjust_wallet_balance", {
        p_user_id: user.id,
        p_currency: "trading",
        p_amount: amount,
      });
      throw tradeEntryErr;
    }

    // Log transaction
    const { error: txLogErr } = await supabaseAdmin.from("transactions").insert({
      user_id: user.id,
      amount: -amount,
      total_value: amount,
      type: "managed_trade_entry",
      symbol: trade.asset_symbol,
      price: currentPrice || 0,
      status: "completed"
    });

    if (txLogErr) {
      console.error("Failed to log trade entry transaction:", txLogErr);
    }

    // 4. Notify User and Admins
    try {
      const { sendPushNotification, sendPushToAdmins } = await import("@/lib/push-notifications");
      
      // Notify User
      await sendPushNotification(user.id, {
        title: "Trade Successful",
        body: `You've successfully opened a $${amount.toLocaleString()} trade in ${trade.asset_symbol} managed trade.`,
        url: "/trade"
      });

      // Notify Admins
      await sendPushToAdmins({
        title: "User Entered Trade",
        body: `${user.email} entered $${amount.toLocaleString()} ${direction.toUpperCase()} on ${trade.asset_symbol} (Trade ID: ${trade.id}).`,
        url: "/admin"
      });
    } catch (pushErr) {
      console.error("Failed to send notification:", pushErr);
    }

    return NextResponse.json(tradeEntry);
  } catch (error: any) {
    console.error("Trading error:", error);
    return NextResponse.json({ message: error.message || "Failed to open trade" }, { status: 500 });
  }
}
