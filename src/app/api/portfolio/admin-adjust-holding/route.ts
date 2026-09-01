import { NextResponse } from "next/server";
import { createClient, supabaseAdmin } from "@/lib/supabase-server";

// POST /api/portfolio/admin-adjust-holding
// Admin-only: adjust a user's specific holding by a USD value.
//   positive delta → add value (recorded as holding_profit)
//   negative delta → reduce value (recorded as holding_loss)
// Body: { user_id, holding_id, usd_amount }
//   usd_amount is always positive; direction is determined by `action: 'add' | 'reduce'`
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { user_id, holding_id, usd_amount, action } = body;

    if (!user_id || !holding_id || !usd_amount || !action) {
      return NextResponse.json({ error: "Missing required fields: user_id, holding_id, usd_amount, action" }, { status: 400 });
    }

    const amount = Math.abs(Number(usd_amount));
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: "usd_amount must be a positive number" }, { status: 400 });
    }

    // 1. Fetch the holding
    const { data: holding, error: holdingErr } = await supabaseAdmin
      .from("holdings")
      .select("*")
      .eq("id", holding_id)
      .eq("user_id", user_id)
      .single();

    if (holdingErr || !holding) {
      return NextResponse.json({ error: "Holding not found" }, { status: 404 });
    }

    // 2. Fetch current asset price
    const { data: asset } = await supabaseAdmin
      .from("assets")
      .select("price")
      .eq("symbol", holding.asset_symbol)
      .maybeSingle();

    const currentPrice = asset?.price || holding.avg_buy_price || 1;

    // 3. Calculate quantity delta (how many units correspond to the USD amount at current price)
    const qtyDelta = amount / currentPrice;

    if (action === "add") {
      // Add units WITHOUT increasing total_invested.
      // Result: currentValue rises, cost basis stays flat → PnL shows as PROFIT.
      const newQty = holding.quantity + qtyDelta;
      const newAvgPrice = holding.total_invested > 0
        ? holding.total_invested / newQty   // cost basis per unit goes DOWN as free units are added
        : currentPrice;

      const { error: updateErr } = await supabaseAdmin
        .from("holdings")
        .update({
          quantity: newQty,
          avg_buy_price: newAvgPrice,
          // total_invested intentionally unchanged — this is what makes PnL show profit
          updated_at: new Date().toISOString(),
        })
        .eq("id", holding_id);

      if (updateErr) throw updateErr;

      // Log as profit transaction for the user
      await supabaseAdmin.from("transactions").insert({
        user_id,
        type: "holding_profit",
        amount: amount,
        total_value: amount,
        symbol: holding.asset_symbol,
        price: currentPrice,
        status: "completed",
      });

    } else if (action === "reduce") {
      // Remove units WITHOUT reducing total_invested.
      // Result: currentValue drops, cost basis stays flat → PnL shows as LOSS.
      const newQty = Math.max(0, holding.quantity - qtyDelta);

      if (newQty <= 0.000001) {
        // Wiped out — delete holding
        await supabaseAdmin.from("holdings").delete().eq("id", holding_id);
      } else {
        const { error: updateErr } = await supabaseAdmin
          .from("holdings")
          .update({
            quantity: newQty,
            avg_buy_price: holding.avg_buy_price, // keep avg_buy_price unchanged
            // total_invested intentionally unchanged — this is what makes PnL show loss
            updated_at: new Date().toISOString(),
          })
          .eq("id", holding_id);

        if (updateErr) throw updateErr;
      }

      // Log as loss transaction for the user
      await supabaseAdmin.from("transactions").insert({
        user_id,
        type: "holding_loss",
        amount: 0,
        total_value: amount,
        symbol: holding.asset_symbol,
        price: currentPrice,
        status: "completed",
      });

    } else {
      return NextResponse.json({ error: "action must be 'add' or 'reduce'" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Admin holding adjust error:", error);
    return NextResponse.json({ message: error.message || "Failed to adjust holding" }, { status: 500 });
  }
}
