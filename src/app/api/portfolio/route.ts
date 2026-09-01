import { NextResponse } from "next/server";
import { createClient, supabaseAdmin } from "@/lib/supabase-server";

// GET /api/portfolio — returns current user's holdings
// GET /api/portfolio?user_id=xxx — admin fetches a specific user's holdings
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const queryUserId = url.searchParams.get("user_id");

    // If requesting another user's holdings, require admin
    if (queryUserId && queryUserId !== user.id) {
      const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
      if (profile?.role !== "admin") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const targetUserId = queryUserId || user.id;

    const { data, error } = await supabaseAdmin
      .from("holdings")
      .select("*")
      .eq("user_id", targetUserId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (error: any) {
    console.error("Portfolio fetch error:", error);
    return NextResponse.json({ message: error.message || "Failed to fetch portfolio" }, { status: 500 });
  }
}
