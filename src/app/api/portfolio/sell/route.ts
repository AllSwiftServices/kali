import { NextResponse } from "next/server";
import { createClient, supabaseAdmin } from "@/lib/supabase-server";

// POST /api/portfolio/sell
// Body: { asset_symbol, quantity }
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { asset_symbol, quantity } = body;

    if (!asset_symbol || !quantity) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 1. Get holding
    const { data: holding, error: holdingErr } = await supabaseAdmin
      .from("holdings")
      .select("*")
      .eq("user_id", user.id)
      .eq("asset_symbol", asset_symbol)
      .single();

    if (holdingErr || !holding) {
      return NextResponse.json({ error: "Holding not found" }, { status: 404 });
    }

    if (holding.quantity < quantity) {
      return NextResponse.json({ error: "Insufficient quantity" }, { status: 400 });
    }

    // 2. Get current asset price
    const { data: asset, error: assetErr } = await supabaseAdmin
      .from("assets")
      .select("price")
      .eq("symbol", asset_symbol)
      .single();

    if (assetErr || !asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    const proceeds = quantity * asset.price;

    // 3. Credit holding wallet
    const { data: wallet, error: walletErr } = await supabaseAdmin
      .from("wallets")
      .select("*")
      .eq("user_id", user.id)
      .eq("currency", "holding")
      .single();

    if (walletErr || !wallet) {
      return NextResponse.json({ error: "Holding wallet not found" }, { status: 400 });
    }

    await supabaseAdmin.from("wallets").update({
      main_balance: wallet.main_balance + proceeds,
      available_balance: wallet.available_balance + proceeds,
      updated_at: new Date().toISOString(),
    }).eq("id", wallet.id);

    // 4. Update or delete holding
    const remainingQty = holding.quantity - quantity;
    if (remainingQty <= 0.000001) {
      await supabaseAdmin.from("holdings").delete().eq("id", holding.id);
    } else {
      const soldProportion = quantity / holding.quantity;
      const remainingInvested = holding.total_invested * (1 - soldProportion);
      await supabaseAdmin.from("holdings").update({
        quantity: remainingQty,
        total_invested: remainingInvested,
        updated_at: new Date().toISOString(),
      }).eq("id", holding.id);
    }

    // 5. Log transaction (non-fatal)
    try {
      await supabaseAdmin.from("transactions").insert({
        user_id: user.id,
        type: "trade_sell",
        amount: proceeds,
        total_value: proceeds,
        symbol: "USD",
        status: "completed",
      });

      // Notify admins
      const { sendPushToAdmins } = await import("@/lib/push-notifications");
      await sendPushToAdmins({
        title: "New Asset Sale",
        body: `${user.email} sold ${quantity} ${asset_symbol} for $${proceeds.toLocaleString()}.`,
        url: "/admin",
      });
    } catch (e) { console.error("Post-sell actions failed:", e); }

    return NextResponse.json({ success: true, proceeds });
  } catch (error: any) {
    console.error("Sell error:", error);
    return NextResponse.json({ message: error.message || "Failed to sell asset" }, { status: 500 });
  }
}
