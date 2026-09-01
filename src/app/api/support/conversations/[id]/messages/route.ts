import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { sendPushToUser } from "@/lib/push";
import { sendPushToAdmins } from "@/lib/push-notifications";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Verify the user owns this conversation (or is admin)
    const { data: profile } = await supabaseAdmin.from("users").select("role").eq("id", user.id).single();
    const isAdmin = profile?.role === "admin";

    const { data: conv } = await supabaseAdmin
      .from("support_conversations")
      .select("user_id")
      .eq("id", id)
      .single();

    if (!conv || (!isAdmin && conv.user_id !== user.id)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { data, error } = await supabaseAdmin
      .from("support_messages")
      .select("*, users(name, email)")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { body: msgBody } = await request.json();
    if (!msgBody?.trim()) return NextResponse.json({ error: "Message cannot be empty" }, { status: 400 });

    const { data: profile } = await supabaseAdmin.from("users").select("role, name").eq("id", user.id).single();
    const senderRole = profile?.role === "admin" ? "admin" : "user";

    const { data, error } = await supabaseAdmin
      .from("support_messages")
      .insert({
        conversation_id: id,
        sender_id: user.id,
        sender_role: senderRole,
        body: msgBody.trim(),
      })
      .select()
      .single();

    if (error) throw error;

    // Update conversation updated_at
    await supabaseAdmin
      .from("support_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", id);

    // Notifications
    if (senderRole === "admin") {
      // Send push notification to the user when admin replies
      const { data: conv } = await supabaseAdmin
        .from("support_conversations")
        .select("user_id")
        .eq("id", id)
        .single();

      if (conv?.user_id) {
        // Fire and forget — don't await so we don't delay the response
        sendPushToUser(conv.user_id, {
          title: "New message from Support 💬",
          body: msgBody.trim().slice(0, 120),
          url: "/profile/chat",
        }).catch(() => {/* swallow errors */});
      }
    } else {
      // Send push notification to admins when user sends a message
      const displayName = profile?.name || user.email;
      sendPushToAdmins({
        title: "New Support Message",
        body: `${displayName}: ${msgBody.trim().slice(0, 100)}${msgBody.trim().length > 100 ? "..." : ""}`,
        url: "/admin?tab=support",
      }).catch((e) => console.error("Failed to notify admins", e));
    }

    return NextResponse.json({ data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
