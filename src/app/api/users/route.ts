import { NextResponse } from "next/server";
import { createClient, supabaseAdmin } from "@/lib/supabase-server";

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

    // Fetch all users
    const { data: usersData, error } = await supabaseAdmin
      .from("users")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Fetch all KYC records to get the most up-to-date status
    const { data: kycRecords } = await supabaseAdmin
      .from("kyc")
      .select("user_id, status, updated_at")
      .order("updated_at", { ascending: false });

    // Build a map of user_id -> latest kyc status
    const kycMap = new Map<string, string>();
    if (kycRecords) {
      for (const kyc of kycRecords) {
        if (!kycMap.has(kyc.user_id)) {
          kycMap.set(kyc.user_id, kyc.status);
        }
      }
    }

    // Merge real-time kyc_status into each user object
    const enrichedUsers = (usersData || []).map(u => ({
      ...u,
      kyc_status: kycMap.get(u.id) || u.kyc_status || 'not_started',
    }));

    return NextResponse.json(enrichedUsers);
  } catch (error: any) {
    console.error("Users fetch error:", error);
    return NextResponse.json(
      { message: error.message || "Failed to fetch users" },
      { status: 500 }
    );
  }
}

