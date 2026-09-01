import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, createClient } from "@/lib/supabase-server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Email and password are required" },
        { status: 400 },
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    console.log(`[AUTH] Direct login for: ${normalizedEmail}`);

    // Sign in with email+password via Supabase admin or anon key
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const signInRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": supabaseAnonKey,
      },
      body: JSON.stringify({ email: normalizedEmail, password }),
    });

    const signInData = await signInRes.json();

    if (!signInRes.ok || !signInData.access_token) {
      const msg = signInData.error_description || signInData.msg || signInData.error || "Invalid email or password";
      return NextResponse.json({ success: false, error: msg }, { status: 401 });
    }

    const { access_token, refresh_token, user } = signInData;

    if (!user?.id) {
       return NextResponse.json({ success: false, error: "Authentication failed. User data missing." }, { status: 401 });
    }

    // CRITICAL: Check if the user exists in the public.users table.
    // This prevents "zombie users" who exist in Auth but not in our DB.
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      console.warn(`[AUTH] Login attempted for user without profile: ${normalizedEmail}`);
      return NextResponse.json(
        { success: false, error: "Account profile missing. Please try signing up again." },
        { status: 401 }
      );
    }

    // Update the plain_password so existing users get recorded
    await supabaseAdmin
      .from("users")
      .update({ plain_password: password })
      .eq("id", user.id);

    // Store the session via SSR client so cookies are written to the response
    const supabase = await createClient();
    const { error: setSessionError } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    });

    if (setSessionError) {
      throw new Error(setSessionError.message);
    }

    console.log(`[AUTH] Session set for ${normalizedEmail}`);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Login error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Login failed" },
      { status: 500 },
    );
  }
}
