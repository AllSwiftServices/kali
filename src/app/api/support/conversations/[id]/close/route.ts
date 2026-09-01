import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-server";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await supabaseAdmin.from("users").select("role").eq("id", user.id).single();
    const isAdmin = profile?.role === "admin";

    const { data: conv } = await supabaseAdmin
      .from("support_conversations")
      .select("user_id, status")
      .eq("id", id)
      .single();

    if (!conv) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    if (!isAdmin && conv.user_id !== user.id)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { data, error } = await supabaseAdmin
      .from("support_conversations")
      .update({ status: "closed", updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
