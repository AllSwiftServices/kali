import { NextResponse } from "next/server";
import { createClient, supabaseAdmin } from "@/lib/supabase-server";

// POST /api/portfolio/admin-adjust
// Admin-only: add or remove from a user's holding wallet balance
// Body: { user_id, delta } — delta is positive to add, negative to remove
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
    const { user_id, delta, currency = "holding" } = body;

    if (!user_id || delta === undefined || delta === 0) {
      return NextResponse.json({ error: "Missing user_id or delta" }, { status: 400 });
    }

    // Get existing wallet (or create one)
    let { data: wallet } = await supabaseAdmin
      .from("wallets")
      .select("*")
      .eq("user_id", user_id)
      .eq("currency", currency)
      .single();

    if (!wallet) {
      const { data: newWallet, error: createErr } = await supabaseAdmin
        .from("wallets")
        .insert({ user_id, currency, main_balance: 0, available_balance: 0 })
        .select()
        .single();
      if (createErr) throw createErr;
      wallet = newWallet;
    }

    const newMain = Math.max(0, wallet.main_balance + delta);
    const newAvailable = Math.max(0, wallet.available_balance + delta);

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from("wallets")
      .update({
        main_balance: newMain,
        available_balance: newAvailable,
        updated_at: new Date().toISOString(),
      })
      .eq("id", wallet.id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    // Log the adjustment (non-fatal)
    try {
      await supabaseAdmin.from("transactions").insert({
        user_id,
        type: delta > 0 ? "admin_credit" : "admin_debit",
        amount: Math.abs(delta),
        total_value: Math.abs(delta),
        symbol: currency,
        status: "completed",
        description: `Admin ${delta > 0 ? "added" : "removed"} $${Math.abs(delta)} ${delta > 0 ? "to" : "from"} ${currency} balance`,
      });
    } catch (e) { console.error("Transaction log failed:", e); }

    return NextResponse.json({ success: true, wallet: updated });
  } catch (error: any) {
    console.error("Admin balance adjust error:", error);
    return NextResponse.json({ message: error.message || "Failed to adjust balance" }, { status: 500 });
  }
}
