import { NextResponse } from "next/server";
import { createClient, supabaseAdmin } from "@/lib/supabase-server";

// POST /api/portfolio/buy
// Body: { asset_symbol, asset_name, asset_type, quantity, price_per_unit }
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { asset_symbol, asset_name, asset_type, quantity, price_per_unit } = body;

    if (!asset_symbol || !quantity || !price_per_unit) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const totalCost = quantity * price_per_unit;

    // 1. Check holding wallet balance
    const { data: wallet, error: walletErr } = await supabaseAdmin
      .from("wallets")
      .select("*")
      .eq("user_id", user.id)
      .eq("currency", "holding")
      .single();

    if (walletErr || !wallet) {
      return NextResponse.json({ error: "Holding wallet not found" }, { status: 400 });
    }

    if (wallet.available_balance < totalCost) {
      return NextResponse.json({ error: "Insufficient holding balance" }, { status: 400 });
    }

    // 2. Deduct from wallet
    const { error: deductErr } = await supabaseAdmin
      .from("wallets")
      .update({
        main_balance: wallet.main_balance - totalCost,
        available_balance: wallet.available_balance - totalCost,
        updated_at: new Date().toISOString(),
      })
      .eq("id", wallet.id);

    if (deductErr) throw deductErr;

    // 3. Upsert holding — merge into existing position or create new
    const { data: existing } = await supabaseAdmin
      .from("holdings")
      .select("*")
      .eq("user_id", user.id)
      .eq("asset_symbol", asset_symbol)
      .maybeSingle();

    let holding;
    if (existing) {
      // Update existing position: weighted average buy price
      const newTotalQty = existing.quantity + quantity;
      const newAvgPrice = (existing.total_invested + totalCost) / newTotalQty;
      const { data, error } = await supabaseAdmin
        .from("holdings")
        .update({
          quantity: newTotalQty,
          avg_buy_price: newAvgPrice,
          total_invested: existing.total_invested + totalCost,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select()
        .single();
      if (error) throw error;
      holding = data;
    } else {
      // New position
      const { data, error } = await supabaseAdmin
        .from("holdings")
        .insert({
          user_id: user.id,
          asset_symbol,
          asset_name,
          asset_type,
          quantity,
          avg_buy_price: price_per_unit,
          total_invested: totalCost,
        })
        .select()
        .single();
      if (error) throw error;
      holding = data;
    }

    // Log transaction (non-fatal)
    try {
      await supabaseAdmin.from("transactions").insert({
        user_id: user.id,
        type: "trade_buy",
        amount: totalCost,
        total_value: totalCost,
        symbol: "USD",
        status: "completed",
      });

      // Notify admins
      const { sendPushToAdmins } = await import("@/lib/push-notifications");
      await sendPushToAdmins({
        title: "New Asset Purchase",
        body: `${user.email} bought ${quantity} ${asset_symbol} at $${price_per_unit} (Total: $${totalCost.toLocaleString()}).`,
        url: "/admin",
      });
    } catch (e) { console.error("Post-buy actions failed:", e); }

    return NextResponse.json({ success: true, holding });
  } catch (error: any) {
    console.error("Buy error:", error);
    return NextResponse.json({ message: error.message || "Failed to buy asset" }, { status: 500 });
  }
}
