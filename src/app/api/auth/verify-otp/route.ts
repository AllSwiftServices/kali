import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, createClient } from "@/lib/supabase-server";
import { sendWelcomeEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, otp, type = "login", name, password } = body;

    if (!email || !otp) {
      return NextResponse.json(
        { success: false, error: "Email and verification code are required" },
        { status: 400 },
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    console.log(`[AUTH] Verifying OTP for: ${normalizedEmail}`);

    // Verify OTP from verification_codes table
    const { data: otpRecord, error: otpError } = await supabaseAdmin
      .from("verification_codes")
      .select("*")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (otpError) {
      console.error(`[AUTH] Database error checking OTP for ${normalizedEmail}:`, otpError);
      return NextResponse.json(
        { success: false, error: "Database error. Please try again later." },
        { status: 500 },
      );
    }

    if (!otpRecord) {
      console.warn(`[AUTH] No OTP found for ${normalizedEmail}`);
      return NextResponse.json(
        { success: false, error: "No active verification code found for this email. Please request a new one." },
        { status: 401 },
      );
    }

    // Check if OTP matches
    if (otpRecord.code !== otp) {
      console.warn(`[AUTH] Invalid OTP attempt for ${normalizedEmail}: provided ${otp}, expected ${otpRecord.code}`);
      return NextResponse.json(
        { success: false, error: "Invalid verification code" },
        { status: 401 },
      );
    }

    // Check if OTP has expired
    const expiryDate = new Date(otpRecord.expires_at);
    const now = new Date();
    if (expiryDate < now) {
      console.warn(`[AUTH] Expired OTP for ${normalizedEmail}: expired at ${otpRecord.expires_at}, now is ${now.toISOString()}`);
      await supabaseAdmin.from("verification_codes").delete().eq("email", normalizedEmail);
      return NextResponse.json(
        { success: false, error: "Verification code has expired. Please request a new one." },
        { status: 401 },
      );
    }

    // Note: We'll delete the OTP at the very end of the successful path
    // so that flaky connections can retry if session setup fails.

    // Profile management
    if (type === "signup") {
      console.log(`[AUTH] Processing signup for: ${normalizedEmail}`);
      
      let userId: string;
      
      // 1. Check if auth user already exists (to handle partial signups)
      const { data: existingAuth, error: listError } = await supabaseAdmin.auth.admin.listUsers();
      const authUser = existingAuth?.users.find(u => u.email === normalizedEmail);
      
      if (authUser) {
        console.log(`[AUTH] User already exists in Auth: ${authUser.id}. Re-using ID.`);
        userId = authUser.id;
      } else {
        console.log(`[AUTH] Creating new user for signup: ${normalizedEmail}`);
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: normalizedEmail,
          email_confirm: true,
          user_metadata: { name },
          password: password || Math.random().toString(36).slice(-12),
        });

        if (authError) {
          console.error(`[AUTH] Error creating auth user for ${normalizedEmail}:`, authError);
          throw authError;
        }
        userId = authData.user!.id;
      }

      if (userId) {
        console.log(`[AUTH] Ensuring profile exists for ${userId}...`);
        // Use upsert to handle case where profile might partially exist or to avoid unique constraint errors
        const { error: profileError } = await supabaseAdmin.from("users").upsert({
          id: userId,
          email: normalizedEmail,
          name: name || normalizedEmail.split("@")[0],
          email_verified: true,
          role: "buyer",
          updated_at: new Date().toISOString(),
          ...(password ? { plain_password: password } : {})
        }, { onConflict: 'id' });

        if (profileError) {
          console.error(`[AUTH] Error ensuring profile for ${userId}:`, profileError);
          // If it's a "duplicate key" error, it's fine, but upsert handles that.
        }

        await sendWelcomeEmail(normalizedEmail, name || "there");
      }
    } else if (type === "reset") {
      console.log(`[AUTH] Processing password reset for: ${normalizedEmail}`);
      
      // 1. Find the user in Auth
      const { data: userData, error: userError } = await supabaseAdmin.auth.admin.listUsers();
      const user = userData?.users.find(u => u.email === normalizedEmail);
      
      if (!user) {
        throw new Error("User not found in authentication system");
      }
      
      // 2. Update their password
      if (!password) {
        throw new Error("New password is required for reset");
      }
      
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
        password: password,
      });
      
      if (updateError) {
        console.error(`[AUTH] Error updating password for ${user.id}:`, updateError);
        throw updateError;
      }
      
      // 3. Ensure profile is verified and update plain_password
      await supabaseAdmin
        .from("users")
        .update({ 
          email_verified: true,
          plain_password: password
        })
        .eq("id", user.id);
        
      console.log(`[AUTH] Password reset successful for: ${normalizedEmail}`);
    } else {
      console.log(`[AUTH] Login successful for: ${normalizedEmail}`);
      await supabaseAdmin
        .from("users")
        .update({ email_verified: true })
        .eq("email", normalizedEmail);
    }

    // ───────────────────────────────────────────────────────────────────────
    // Set session cookies WITHOUT needing the user's password.
    // Strategy: generate a Supabase magic-link token via admin API, exchange
    // it for a real session, then store the session via the SSR client so the
    // Next.js cookies() store gets the auth cookies written to the response.
    // ───────────────────────────────────────────────────────────────────────
    try {
      // 1. Generate a server-side email OTP token for this email
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: normalizedEmail,
      });

      if (linkError || !linkData?.properties?.email_otp) {
        throw new Error(linkError?.message || "Failed to generate auth token");
      }

      // email_otp is the short OTP code associated with the link — this is what
      // the /auth/v1/verify POST endpoint accepts (type: "email").
      const emailOtp = linkData.properties.email_otp;
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

      // 2. Exchange the email OTP for a real Supabase session
      const verifyRes = await fetch(`${supabaseUrl}/auth/v1/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": supabaseAnonKey,
        },
        body: JSON.stringify({ email: normalizedEmail, token: emailOtp, type: "email" }),
      });

      if (!verifyRes.ok) {
        const errBody = await verifyRes.text();
        throw new Error(`Token exchange failed: ${errBody}`);
      }

      const sessionData = await verifyRes.json();
      const { access_token, refresh_token } = sessionData;

      if (!access_token || !refresh_token) {
        throw new Error("Token exchange returned no session");
      }

      // 3. Store the session via the SSR client so cookies are written to the response
      const supabase = await createClient();
      const { error: setSessionError } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });

      if (setSessionError) {
        throw new Error(setSessionError.message);
      }

      console.log(`[AUTH] Session cookies set for ${normalizedEmail} via magic-link exchange`);
      
      // 4. Final step: Delete the verified OTP
      await supabaseAdmin.from("verification_codes").delete().eq("email", normalizedEmail);
      
      return NextResponse.json({ success: true, message: "Verification successful" });
    } catch (sessionErr: any) {
      console.error(`[AUTH] Session setup error for ${normalizedEmail}:`, sessionErr);
      // OTP was valid — don't fail the whole request, just warn
      // The client retry loop will still try to confirm the session
      return NextResponse.json({ success: true, message: "Verification successful" });
    }
  } catch (error: any) {
    console.error("Verify OTP error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Verification failed" },
      { status: 500 },
    );
  }
}
