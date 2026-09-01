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
      .from("wallets")
      .select("*")
      .eq("user_id", user.id);

    if (error) throw error;

    // If wallets don't exist, create default trading and holding wallets
    if (!data || data.length === 0) {
      const walletsToCreate = [
        {
          user_id: user.id,
          currency: "trading",
          main_balance: 0,
          available_balance: 0,
        },
        {
          user_id: user.id,
          currency: "holding",
          main_balance: 0,
          available_balance: 0,
        }
      ];

      const { data: newWallets, error: createError } = await supabase
        .from("wallets")
        .insert(walletsToCreate)
        .select();

      if (createError) throw createError;
      return NextResponse.json(newWallets);
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Fetch wallets error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch wallets" },
      { status: 500 }
    );
  }
}
