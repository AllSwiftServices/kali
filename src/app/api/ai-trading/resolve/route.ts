import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { resolveAiTrade } from "@/lib/ai-trading";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { tradeId } = body;

    if (!tradeId) {
      return NextResponse.json({ error: "Missing trade ID" }, { status: 400 });
    }

    const result = await resolveAiTrade(tradeId);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("AI Trade resolve error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to resolve AI trade" },
      { status: 500 }
    );
  }
}
