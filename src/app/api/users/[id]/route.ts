import { NextResponse } from "next/server";
import { createClient, supabaseAdmin } from "@/lib/supabase-server";

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

    // Only the user themselves or an admin may fetch full details
    const { data: callerProfile } = await supabase.from("users").select("role").eq("id", user.id).single();
    const isAdmin = callerProfile?.role === "admin";
    if (user.id !== id && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch user profile
    const { data: profile, error } = await supabaseAdmin.from("users").select("*").eq("id", id).single();
    if (error) throw error;

    // For admin, also fetch wallets + holdings
    if (isAdmin) {
      const [{ data: wallets }, { data: holdings }, { data: kyc }] = await Promise.all([
        supabaseAdmin.from("wallets").select("*").eq("user_id", id),
        supabaseAdmin.from("holdings").select("*").eq("user_id", id).order("created_at", { ascending: false }),
        supabaseAdmin.from("kyc").select("*").eq("user_id", id).order("updated_at", { ascending: false }).limit(1),
      ]);
      return NextResponse.json({ ...profile, wallets: wallets || [], holdings: holdings || [], kyc: kyc?.[0] || null });
    }

    // Omit plain_password for non-admin requests
    const { plain_password, ...publicProfile } = profile;
    return NextResponse.json(publicProfile);
  } catch (error: any) {
    console.error("User fetch error:", error);
    return NextResponse.json({ message: error.message || "Failed to fetch user" }, { status: 500 });
  }
}


export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = (await params).id;
    const supabase = await createClient();
    const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Role check
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", currentUser.id)
      .single();

    // Only allow updating own profile or admin updating anyone
    if (currentUser.id !== id && profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    
    // Safety check: only admins can update roles
    if (body.role && profile?.role !== "admin") {
      delete body.role;
    }

    const { data, error } = await supabase
      .from("users")
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("User update error:", error);
    return NextResponse.json(
      { message: error.message || "Failed to update user" },
      { status: 500 }
    );
  }
}

export async function PUT(
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

    // Allow users to update their own profile, or admins to update anyone
    const { data: callerProfile } = await supabaseAdmin.from("users").select("role").eq("id", user.id).single();
    const isAdmin = callerProfile?.role === "admin";

    if (user.id !== id && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { name } = body;

    // 1. Update public.users table (use admin client to bypass RLS)
    const { data: updatedUser, error: updateError } = await supabaseAdmin
      .from("users")
      .update({
        name,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) throw updateError;

    // 2. Update Auth metadata as well to keep in sync
    const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
      id,
      { user_metadata: { full_name: name } }
    );

    if (authUpdateError) {
      console.warn("Failed to update auth metadata:", authUpdateError);
    }

    return NextResponse.json(updatedUser);
  } catch (error: any) {
    console.error("User update error:", error);
    return NextResponse.json(
      { message: error.message || "Failed to update user" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = (await params).id;
    const supabase = await createClient();
    const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Role check: Only admins can delete users
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", currentUser.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Prevent self-deletion
    if (currentUser.id === id) {
      return NextResponse.json({ error: "Cannot delete your own admin account" }, { status: 400 });
    }

    // 1. Delete from Auth (this is critical)
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (authDeleteError) {
      console.error("Auth delete error:", authDeleteError);
      // Even if auth delete fails (e.g. user already gone from auth), we might still want to try cleaning up the DB
    }

    // 2. Manual Cascade Cleanup for dependent tables
    // We do this because some foreign keys might not have ON DELETE CASCADE set up
    try {
      // a. Support system cleanup
      // First delete messages sent by user
      await supabaseAdmin.from("support_messages").delete().eq("sender_id", id);
      
      // Then delete messages in user's conversations
      const { data: userConvs } = await supabaseAdmin.from("support_conversations").select("id").eq("user_id", id);
      if (userConvs && userConvs.length > 0) {
        const convIds = userConvs.map(c => c.id);
        await supabaseAdmin.from("support_messages").delete().in("conversation_id", convIds);
        await supabaseAdmin.from("support_conversations").delete().in("id", convIds);
      }

      // b. Trading cleanup
      await supabaseAdmin.from("managed_trade_stakes").delete().eq("user_id", id);
      await supabaseAdmin.from("ai_trades").delete().eq("user_id", id);
      await supabaseAdmin.from("holdings").delete().eq("user_id", id);
      
      // c. Financial cleanup
      await supabaseAdmin.from("transactions").delete().eq("user_id", id);
      await supabaseAdmin.from("deposits").delete().eq("user_id", id);
      await supabaseAdmin.from("withdrawals").delete().eq("user_id", id);
      await supabaseAdmin.from("wallets").delete().eq("user_id", id);

      // d. Identity & Notifications cleanup
      await supabaseAdmin.from("kyc").delete().eq("user_id", id);
      await supabaseAdmin.from("notifications").delete().eq("user_id", id);

    } catch (cleanupError) {
      console.error("Manual cleanup error (non-fatal):", cleanupError);
      // We continue to try deleting the user profile anyway
    }

    // 3. Delete from public.users (triggers cascades for any remaining if configured)
    const { error: dbDeleteError } = await supabaseAdmin
      .from("users")
      .delete()
      .eq("id", id);

    if (dbDeleteError) throw dbDeleteError;

    return NextResponse.json({ success: true, message: "User deleted successfully" });
  } catch (error: any) {
    console.error("User deletion error:", error);
    return NextResponse.json(
      { message: error.message || "Failed to delete user" },
      { status: 500 }
    );
  }
}
