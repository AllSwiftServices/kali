import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { resolveAiTrade } from "@/lib/ai-trading";

// GET or POST /api/ai-trading/cron — Automated resolution for expired AI trades
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
    
    // Check for secret key
    const isValid = (process.env.CRON_SECRET && (
      authHeader === `Bearer ${process.env.CRON_SECRET}` || 
      key === process.env.CRON_SECRET
    ));

    if (process.env.CRON_SECRET && !isValid) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Find all pending AI trades that have passed their resolves_at time
    const { data: expiredTrades, error } = await supabaseAdmin
      .from("ai_trades")
      .select("id")
      .eq("status", "pending")
      .lt("resolves_at", new Date().toISOString());

    if (error) throw error;

    const results = [];

    if (expiredTrades && expiredTrades.length > 0) {
      for (const trade of expiredTrades) {
        try {
          const resData = await resolveAiTrade(trade.id);
          results.push({ id: trade.id, status: 'success', ...resData });
        } catch (e: any) {
          console.error(`AI Cron: Failed to resolve trade ${trade.id}:`, e);
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
    console.error("AI trading cron error:", error);
    return NextResponse.json({ success: false, message: error.message || "Cron failed" }, { status: 500 });
  }
}
