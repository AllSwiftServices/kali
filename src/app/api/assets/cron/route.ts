import { NextResponse } from "next/server";
import { syncAssetPrices } from "@/lib/assets";

// GET or POST /api/assets/cron — Automated asset price refresh
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

    console.log("Assets Cron: Starting price refresh...");
    const result = await syncAssetPrices();
    console.log("Assets Cron: Refresh complete.", result);

    return NextResponse.json({
      success: true,
      ...result
    });
  } catch (error: any) {
    console.error("Assets cron error:", error);
    return NextResponse.json({ success: false, message: error.message || "Cron failed" }, { status: 500 });
  }
}
