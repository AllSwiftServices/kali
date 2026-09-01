import { NextResponse } from "next/server";
import { createClient, supabaseAdmin } from "@/lib/supabase-server";
import { sendPushNotification } from "@/lib/push-notifications";
import { sendKycEmail } from "@/lib/email";

export async function GET(
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

    // Role check
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    // Security check: only allow users to fetch their own KYC or admins
    if (user.id !== id && profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("kyc")
      .select("*")
      .eq("user_id", id)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "No rows found"

    return NextResponse.json(data || null);
  } catch (error: any) {
    console.error("KYC fetch error:", error);
    return NextResponse.json(
      { message: error.message || "Failed to fetch KYC" },
      { status: 500 }
    );
  }
}
export async function PATCH(
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

    // Role check
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { status, rejection_reason } = body;

    // Use supabaseAdmin to bypass RLS — the admin session client cannot update other users' rows
    const { error } = await supabaseAdmin
      .from("kyc")
      .update({
        status,
        rejection_reason,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", id);

    if (error) throw error;

    // Sync the kyc_status column in the users table
    await supabaseAdmin
      .from('users')
      .update({ kyc_status: status })
      .eq('id', id);

    // Fetch user details for notification
    const { data: userData } = await supabaseAdmin
      .from("users")
      .select("email, name")
      .eq("id", id)
      .single();

    try {
        await sendPushNotification(id, {
            title: status === 'approved' ? "Identity Verified! 🎉" : "Verification Update",
            body: status === 'approved' 
                ? "Your identity verification has been approved. You now have full access."
                : `Your KYC application was rejected. Reason: ${rejection_reason || 'See dashboard for details.'}`,
            url: "/verify-identity"
        });
    } catch (e) {
        console.error("Failed to send push notification", e);
    }

    if (userData?.email) {
      try {
        await sendKycEmail(
          userData.email, 
          userData.name || userData.email.split('@')[0], 
          status, 
          rejection_reason
        );
      } catch (e) {
        console.error("Failed to send KYC email", e);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("KYC update error:", error);
    return NextResponse.json(
      { message: error.message || "Failed to update KYC status" },
      { status: 500 }
    );
  }
}

// POST is an alias for PATCH to support simpler admin clients
export { PATCH as POST };
