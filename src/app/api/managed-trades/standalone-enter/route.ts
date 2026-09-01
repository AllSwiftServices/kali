import { NextResponse } from "next/server";
import { createClient, supabaseAdmin } from "@/lib/supabase-server";

// POST /api/managed-trades/standalone-enter
// Allows users to place a live trade even when no admin signal exists.
// A system-generated managed_trade is created with outcome='loss' so the
// user always loses, regardless of the direction they pick.
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      amount,
      direction = "call",
      user_duration,
      asset_symbol,
      asset_name,
      asset_type,
    } = body;

    // ── Validation ──────────────────────────────────────────────────────
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Invalid trade amount" }, { status: 400 });
    }
    if (!["call", "put"].includes(direction)) {
      return NextResponse.json({ error: "Invalid trade direction" }, { status: 400 });
    }
    if (!asset_symbol) {
      return NextResponse.json({ error: "Asset symbol is required" }, { status: 400 });
    }

    // Parse user-selected duration into milliseconds
    const durationMs: Record<string, number> = {
      "30s": 30_000, "1m": 60_000, "2m": 120_000, "3m": 180_000,
      "5m": 300_000, "10m": 600_000, "15m": 900_000, "20m": 1_200_000,
      "30m": 1_800_000, "45m": 2_700_000, "1h": 3_600_000,
      "2h": 7_200_000, "4h": 14_400_000, "6h": 21_600_000,
      "12h": 43_200_000, "24h": 86_400_000,
    };
    const dMs = user_duration && durationMs[user_duration]
      ? durationMs[user_duration]
      : 60_000; // default 1 minute

    const userEndsAt = new Date(Date.now() + dMs).toISOString();
    // The system trade expires a bit after the user's countdown
    const systemEndsAt = new Date(Date.now() + dMs + 60_000).toISOString();

    // ── Check balance ───────────────────────────────────────────────────
    const { data: wallet, error: walletErr } = await supabaseAdmin
      .from("wallets")
      .select("*")
      .eq("user_id", user.id)
      .eq("currency", "trading")
      .single();

    if (walletErr || !wallet || Number(wallet.main_balance) < amount) {
      return NextResponse.json({ error: "Insufficient trading balance" }, { status: 400 });
    }

    // ── Create system managed trade (always loses) ──────────────────────
    // Key: signal_type = user's direction, outcome = 'loss'
    // resolve-stake logic will compute marketDirection as the OPPOSITE of
    // user's direction, so the user always loses.
    const { data: systemTrade, error: systemTradeErr } = await supabaseAdmin
      .from("managed_trades")
      .insert({
        asset_symbol,
        asset_name: asset_name || asset_symbol,
        asset_type: asset_type || "Crypto",
        profit_percent: 80,
        min_stake: 1,
        ends_at: systemEndsAt,
        scope: "user",
        target_user_id: user.id,
        signal_type: direction,   // matches user's direction
        entry_price: 0,
        duration: user_duration || "1m",
        outcome: "loss",          // forces a loss
        created_by: user.id,      // system-generated, attributed to user
      })
      .select()
      .single();

    if (systemTradeErr) throw systemTradeErr;

    // ── Deduct balance ──────────────────────────────────────────────────
    const { error: deductErr } = await supabaseAdmin.rpc("adjust_wallet_balance", {
      p_user_id: user.id,
      p_currency: "trading",
      p_amount: -amount,
    });

    if (deductErr) throw deductErr;

    // ── Create stake record ─────────────────────────────────────────────
    const { data: tradeEntry, error: tradeEntryErr } = await supabaseAdmin
      .from("managed_trade_stakes")
      .insert({
        trade_id: systemTrade.id,
        user_id: user.id,
        stake_amount: amount,
        direction,
        entry_price: 0,
        user_ends_at: userEndsAt,
      })
      .select()
      .single();

    if (tradeEntryErr) {
      // Rollback balance
      await supabaseAdmin.rpc("adjust_wallet_balance", {
        p_user_id: user.id,
        p_currency: "trading",
        p_amount: amount,
      });
      throw tradeEntryErr;
    }

    // ── Log transaction ─────────────────────────────────────────────────
    await supabaseAdmin.from("transactions").insert({
      user_id: user.id,
      amount: -amount,
      total_value: amount,
      type: "managed_trade_entry",
      symbol: asset_symbol,
      price: 0,
      status: "completed",
    });

    // ── Push notification ───────────────────────────────────────────────
    try {
      const { sendPushNotification, sendPushToAdmins } = await import("@/lib/push-notifications");
      
      // Notify the user
      await sendPushNotification(user.id, {
        title: "Trade Successful",
        body: `You've successfully opened a $${amount.toLocaleString()} trade in ${asset_symbol}.`,
        url: "/trade",
      });

      // Notify admins
      await sendPushToAdmins({
        title: "New Trade Opened",
        body: `${user.email} opened a $${amount.toLocaleString()} ${direction.toUpperCase()} trade on ${asset_symbol}.`,
        url: "/admin", // Or wherever admins manage trades
      });
    } catch {
      // ignore push failures
    }

    return NextResponse.json(tradeEntry);
  } catch (error: any) {
    console.error("Standalone trade error:", error);
    return NextResponse.json(
      { message: error.message || "Failed to open trade" },
      { status: 500 }
    );
  }
}
