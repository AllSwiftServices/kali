import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET() {
  try {
    const supabase = await createClient();
    
    // Public settings that are safe for all users to see
    const { data: settings, error } = await supabase
      .from("settings")
      .select("key, value")
      .in("key", ["deposit_methods"]);

    if (error) throw error;

    // Convert array to object for easier consumption
    const settingsMap = settings.reduce((acc: any, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {});

    return NextResponse.json(settingsMap);
  } catch (error: any) {
    console.error("Fetch public settings error:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}
