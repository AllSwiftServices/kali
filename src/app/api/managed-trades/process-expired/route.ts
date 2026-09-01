import { NextResponse } from "next/server";
import { createClient, supabaseAdmin } from "@/lib/supabase-server";
import { processTradePayout } from "@/lib/managed-trades";

// POST /api/managed-trades/process-expired — Trigger payout for a specific trade if expired
export async function POST(request: Request) {
  try {
    // Auth: require either a logged-in user or the CRON_SECRET
    const authHeader = request.headers.get("authorization");
    const cronValid = process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`;

    if (!cronValid) {
      const supabase = await createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const { tradeId } = await request.json();
    
    if (!tradeId) {
      return NextResponse.json({ error: "Trade ID required" }, { status: 400 });
    }

    // 1. Double check the trade is actually expired
    const { data: trade, error: tradeErr } = await supabaseAdmin
      .from("managed_trades")
      .select("status, ends_at")
      .eq("id", tradeId)
      .single();

    if (tradeErr || !trade) {
      return NextResponse.json({ error: "Trade not found" }, { status: 404 });
    }

    if (trade.status !== "active") {
      return NextResponse.json({ message: "Trade already processed" });
    }

    const isExpired = new Date(trade.ends_at).getTime() <= Date.now();
    if (!isExpired) {
      return NextResponse.json({ error: "Trade has not expired yet" }, { status: 400 });
    }

    // 2. Process payout immediately
    const results = await processTradePayout(tradeId);

    return NextResponse.json({
      success: true,
      results
    });
  } catch (error: any) {
    console.error("Instant payout error:", error);
    return NextResponse.json({ success: false, message: error.message || "Failed to process" }, { status: 500 });
  }
}
