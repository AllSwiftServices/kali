import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { sendPushToAdmins } from "@/lib/push-notifications";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Role check
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("kyc")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("KYC list fetch error:", error);
    return NextResponse.json(
      { message: error.message || "Failed to fetch KYC submissions" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    
    // Safe upsert: Update if exists, insert if not, using user_id as the conflict target
    const { data, error } = await supabase
      .from("kyc")
      .upsert({
        ...body,
        user_id: user.id,
        user_email: user.email,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
      .select()
      .maybeSingle();

    if (error) throw error;

    try {
        await sendPushToAdmins({
            title: "New KYC Verification",
            body: `${user.email} submitted a new KYC application for review.`,
            url: "/admin-kyc"
        });
    } catch (e) {
        console.error("Failed to notify admins", e);
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("KYC submission error:", error);
    return NextResponse.json(
      { message: error.message || "Failed to submit KYC" },
      { status: 500 }
    );
  }
}
