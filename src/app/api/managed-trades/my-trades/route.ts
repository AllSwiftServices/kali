import { NextResponse } from "next/server";
import { createClient, supabaseAdmin } from "@/lib/supabase-server";

// GET /api/managed-trades/my-trades — User's own trades history
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: userTrades, error } = await supabaseAdmin
      .from("managed_trade_stakes")
      .select(`
        *,
        managed_trades (
          asset_symbol,
          asset_name,
          asset_type,
          profit_percent,
          status,
          ends_at,
          signal_type,
          entry_price,
          duration
        )
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json(userTrades);
  } catch (error: any) {
    console.error("My trades fetch error:", error);
    return NextResponse.json({ message: error.message || "Failed to fetch trades" }, { status: 500 });
  }
}
