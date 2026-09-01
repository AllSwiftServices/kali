import { NextResponse } from "next/server";
import { createClient, supabaseAdmin } from "@/lib/supabase-server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ count: 0 });

    // Get the user's open conversations
    const { data: convs } = await supabaseAdmin
      .from("support_conversations")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "open");

    if (!convs?.length) return NextResponse.json({ count: 0 });

    const convIds = convs.map((c) => c.id);

    // Count admin messages that arrived after the user's last message (unread)
    // Simple proxy: count all admin messages in those conversations
    // A better approach would need a "last_read_at" column — for now count all admin messages
    const { count } = await supabaseAdmin
      .from("support_messages")
      .select("id", { count: "exact", head: true })
      .in("conversation_id", convIds)
      .eq("sender_role", "admin");

    return NextResponse.json({ count: count || 0 });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}
