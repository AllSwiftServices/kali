import { NextResponse } from "next/server";
import { createClient, supabaseAdmin } from "@/lib/supabase-server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { currentPassword, newPassword } = await request.json();

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json({ error: "New password must be at least 6 characters" }, { status: 400 });
    }

    // Verify current password by attempting to sign in
    if (currentPassword) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

      const verifyRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: supabaseAnonKey },
        body: JSON.stringify({ email: user.email, password: currentPassword }),
      });

      if (!verifyRes.ok) {
        return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
      }
    }

    // Update password via admin API
    const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: newPassword,
    });

    if (error) throw error;

    // Update the plaintext copy in public.users
    await supabaseAdmin
      .from("users")
      .update({ plain_password: newPassword })
      .eq("id", user.id);

    return NextResponse.json({ success: true, message: "Password updated successfully" });
  } catch (err: any) {
    console.error("Change password error:", err);
    return NextResponse.json({ error: err.message || "Failed to update password" }, { status: 500 });
  }
}
