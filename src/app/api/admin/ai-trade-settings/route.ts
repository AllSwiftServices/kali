import { NextResponse } from "next/server";
import { createClient, supabaseAdmin } from "@/lib/supabase-server";

async function verifyAdmin(supabase: any) {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  const { data: profile } = await supabaseAdmin
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();
  return profile?.role === "admin" ? user : null;
}

// GET /api/admin/ai-trade-settings
// Returns current mode + total profit/loss stats from AI trades
export async function GET() {
  try {
    const supabase = await createClient();
    const admin = await verifyAdmin(supabase);
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Current mode
    const { data: setting } = await supabaseAdmin
      .from("site_settings")
      .select("value")
      .eq("key", "ai_trade_mode")
      .single();

    // Total P&L stats from AI trades (across all users)
    const { data: winTx } = await supabaseAdmin
      .from("transactions")
      .select("amount, total_value")
      .eq("type", "trade_win");

    const { data: lossTx } = await supabaseAdmin
      .from("transactions")
      .select("total_value")
      .eq("type", "trade_loss");

    const { data: entryTx } = await supabaseAdmin
      .from("transactions")
      .select("total_value")
      .eq("type", "trade_entry");

    const totalPaidOut = (winTx || []).reduce((s: number, t: any) => s + (t.amount || 0), 0);
    const totalStaked = (entryTx || []).reduce((s: number, t: any) => s + (t.total_value || 0), 0);
    const totalLossCount = (lossTx || []).length;
    const totalWinCount = (winTx || []).length;
    const totalTradeCount = totalWinCount + totalLossCount;
    const houseProfit = totalStaked - totalPaidOut;

    return NextResponse.json({
      mode: setting?.value || "normal",
      stats: {
        totalStaked,
        totalPaidOut,
        houseProfit,
        totalTradeCount,
        totalWinCount,
        totalLossCount,
        winRate: totalTradeCount > 0 ? ((totalWinCount / totalTradeCount) * 100).toFixed(1) : "0.0",
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/admin/ai-trade-settings
// Body: { mode: 'normal' | 'always_win' | 'always_loss' }
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const admin = await verifyAdmin(supabase);
    if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { mode } = await request.json();
    if (!["normal", "always_win", "always_loss"].includes(mode)) {
      return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("site_settings")
      .upsert({ key: "ai_trade_mode", value: mode, updated_at: new Date().toISOString() });

    if (error) throw error;

    return NextResponse.json({ success: true, mode });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
