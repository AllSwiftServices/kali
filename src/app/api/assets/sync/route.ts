import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { syncAssetPrices } from "@/lib/assets";

// POST /api/assets/sync — admin only
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

    const result = await syncAssetPrices();

    return NextResponse.json({
      success: true,
      ...result
    });
  } catch (error: any) {
    console.error("Price sync error:", error);
    return NextResponse.json({ message: error.message || "Price sync failed" }, { status: 500 });
  }
}
