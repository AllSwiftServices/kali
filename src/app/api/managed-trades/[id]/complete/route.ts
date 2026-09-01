import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { processTradePayout } from "@/lib/managed-trades";

// POST /api/managed-trades/[id]/complete — Admin manually completes a trade
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

    const results = await processTradePayout(id);

    return NextResponse.json({
      success: true,
      message: `Trade completed. Paid out ${results.paidOut} traders.`,
      ...results
    });
  } catch (error: any) {
    console.error("Trade completion error:", error);
    return NextResponse.json({ message: error.message || "Failed to complete trade" }, { status: 500 });
  }
}
