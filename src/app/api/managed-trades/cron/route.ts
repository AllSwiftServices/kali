import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { processTradePayout } from "@/lib/managed-trades";

// GET or POST /api/managed-trades/cron — Automated payout for expired trades
export async function GET(request: Request) {
  return handleCron(request);
}

export async function POST(request: Request) {
  return handleCron(request);
}

async function handleCron(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key') || searchParams.get('secret');
    const authHeader = request.headers.get('authorization');
    
    // Check for secret key (either via header or query param)
    const isValid = (process.env.CRON_SECRET && (
      authHeader === `Bearer ${process.env.CRON_SECRET}` || 
      key === process.env.CRON_SECRET
    ));

    if (process.env.CRON_SECRET && !isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Find all active trades that have passed their ends_at time
    const { data: expiredTrades, error } = await supabaseAdmin
      .from("managed_trades")
      .select("id")
      .eq("status", "active")
      .lt("ends_at", new Date().toISOString());

    if (error) throw error;

    const results = [];

    if (expiredTrades && expiredTrades.length > 0) {
      for (const trade of expiredTrades) {
        try {
          const res = await processTradePayout(trade.id);
          results.push({ id: trade.id, status: 'success', ...res });
        } catch (e: any) {
          console.error(`Cron: Failed to process trade ${trade.id}:`, e);
          results.push({ id: trade.id, status: 'failed', error: e.message });
        }
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      details: results
    });
  } catch (error: any) {
    console.error("Managed trades cron error:", error);
    return NextResponse.json({ success: false, message: error.message || "Cron failed" }, { status: 500 });
  }
}
