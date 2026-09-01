import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from("assets")
      .select("*")
      .order("symbol", { ascending: true });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Fetch assets error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch assets" },
      { status: 500 }
    );
  }
}
