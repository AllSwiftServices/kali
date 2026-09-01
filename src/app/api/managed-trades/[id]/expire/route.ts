import { NextResponse } from "next/server";
import { createClient, supabaseAdmin } from "@/lib/supabase-server";

// POST /api/managed-trades/[id]/expire — Admin manually expires a trade (closes entries early)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = (await params).id;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Set ends_at to now
    const now = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from("managed_trades")
      .update({ ends_at: now })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: "Trade entry period ended successfully.",
      trade: data
    });
  } catch (error: any) {
    console.error("Trade expiration error:", error);
    return NextResponse.json({ message: error.message || "Failed to expire trade" }, { status: 500 });
  }
}
