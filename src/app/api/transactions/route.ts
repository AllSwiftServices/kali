import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Fetch transactions error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch transactions" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { type, amount, price, symbol, asset_id, total_value, currency = "trading" } = body;

    // 1. Create transaction record
    const { data: transaction, error: txError } = await supabase
      .from("transactions")
      .insert({
        user_id: user.id,
        asset_id,
        symbol,
        type,
        amount,
        price,
        total_value: total_value || amount, // fallback to amount if total_value is missing
        status: "completed",
      })
      .select()
      .single();

    if (txError) throw txError;

    // 2. Update wallet balance
    const { data: wallet, error: walletError } = await supabase
      .from("wallets")
      .select("*")
      .eq("user_id", user.id)
      .eq("currency", currency)
      .single();

    if (walletError || !wallet) {
      console.error("Wallet not found for adjustment:", { user_id: user.id, currency });
      // Non-fatal if wallet not found? Or throw? For now throw.
      throw new Error(`Wallet not found for currency: ${currency}`);
    }

    let newBalance = wallet.main_balance;
    const valueToAdjust = total_value || amount || 0;

    if (type === "deposit" || type === "sell") {
      newBalance += valueToAdjust;
    } else if (type === "withdraw" || type === "buy") {
      newBalance -= valueToAdjust;
    }

    const { error: updateError } = await supabase
      .from("wallets")
      .update({ 
        main_balance: newBalance,
        available_balance: newBalance,
        updated_at: new Date().toISOString(),
      })
      .eq("id", wallet.id); // Use wallet.id to update ONLY this wallet

    if (updateError) throw updateError;

    return NextResponse.json(transaction);
  } catch (error: any) {
    console.error("Create transaction error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process transaction" },
      { status: 500 }
    );
  }
}
