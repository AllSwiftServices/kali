import { NextResponse } from "next/server";
import { createClient, supabaseAdmin } from "@/lib/supabase-server";

// GET /api/managed-trades — List relevant trades
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
    const isAdmin = profile?.role === "admin";

    let query = supabase.from("managed_trades").select("*").order("created_at", { ascending: false });

    // Users only see active trades scoped to them or everyone
    if (!isAdmin) {
      query = query.eq("status", "active");
    }

    const { data, error } = await query;
    if (error) throw error;

    // Strip sensitive fields from response for non-admin users
    if (!isAdmin && data) {
      const sanitized = data.map((t: any) => ({
        id: t.id,
        asset_symbol: t.asset_symbol,
        asset_name: t.asset_name,
        asset_type: t.asset_type,
        profit_percent: t.profit_percent,
        min_stake: t.min_stake,
        ends_at: t.ends_at,
        status: t.status,
        duration: t.duration,
      }));
      return NextResponse.json(sanitized);
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Managed trades fetch error:", error);
    return NextResponse.json({ message: error.message || "Failed to fetch trades" }, { status: 500 });
  }
}

// POST /api/managed-trades — Admin creates a trade
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
    console.log("Creating managed trade with body:", body);

    const { 
      asset_symbol, asset_name, asset_type, 
      profit_percent, min_amount, min_stake, ends_at, 
      scope, target_user_id,
      signal_type, entry_price, duration, outcome
    } = body;

    const minimumRequiredAmount = min_amount !== undefined ? min_amount : (min_stake !== undefined ? min_stake : 10);

    if (!asset_symbol || profit_percent === undefined || !ends_at) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("managed_trades")
      .insert({
        asset_symbol,
        asset_name,
        asset_type,
        profit_percent: Number(profit_percent),
        min_stake: Number(minimumRequiredAmount),
        ends_at,
        scope: scope || 'all',
        target_user_id,
        signal_type,
        entry_price: entry_price ? Number(entry_price) : null,
        duration,
        outcome: outcome || 'win',
        created_by: user.id
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Managed trade creation error:", error);
    return NextResponse.json({ message: error.message || "Failed to create trade" }, { status: 500 });
  }
}
