import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { sendOtpEmail } from "@/lib/email";

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, type = "login" } = body;

    if (!email) {
      return NextResponse.json(
        { success: false, error: "Email is required" },
        { status: 400 },
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // If login or reset, check if user exists first
    if (type === "login" || type === "reset") {
      console.log(`[AUTH] Checking if user exists for ${type}: ${normalizedEmail}`);
      const { data: existingUser, error: userError } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("email", normalizedEmail)
        .maybeSingle();

      if (userError) {
        console.error(`[AUTH] Database error checking user ${normalizedEmail}:`, userError);
        return NextResponse.json(
          { success: false, error: "Database error. Please try again later." },
          { status: 500 },
        );
      }

      if (!existingUser) {
        console.warn(`[AUTH] ${type} attempt for non-existent user: ${normalizedEmail}`);
        return NextResponse.json(
          { success: false, error: "No account found with this email. Please sign up first." },
          { status: 404 },
        );
      }
      console.log(`[AUTH] User found for ${type}: ${existingUser.id}`);
    }

    // Generate OTP
    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store OTP in Supabase
    // We upsert to handle multiple requests
    const { error: otpError } = await supabaseAdmin
      .from("verification_codes")
      .upsert(
        { 
          email: normalizedEmail, 
          code: otp, 
          expires_at: expiresAt.toISOString() 
        },
        { onConflict: 'email' }
      );

    if (otpError) {
      console.error("Error storing OTP:", otpError);
      throw new Error("Failed to generate verification code");
    }

    await sendOtpEmail(normalizedEmail, otp, type as any);
    console.log(`[AUTH] ${type} OTP email sent successfully to: ${normalizedEmail}`);

    return NextResponse.json({ 
      success: true, 
      message: `${type} OTP sent successfully`
    });
  } catch (error: any) {
    console.error("Send OTP error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to send verification code",
      },
      { status: 500 },
    );
  }
}
