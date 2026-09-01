import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, createClient } from "@/lib/supabase-server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  if (error) {
    console.error(`[AUTH] Google OAuth error: ${error}`);
    return NextResponse.redirect(`${baseUrl}/?error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return NextResponse.redirect(`${baseUrl}/?error=No_code_provided`);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error("[AUTH] Google OAuth missing client credentials");
    return NextResponse.redirect(`${baseUrl}/?error=Server_Misconfiguration`);
  }

  const redirectUri = `${baseUrl}/api/auth/google/callback`;

  try {
    // 1. Exchange code for access token
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const err = await tokenResponse.text();
      throw new Error(`Failed to exchange token: ${err}`);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // 2. Fetch user profile from Google
    const profileResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!profileResponse.ok) {
      throw new Error("Failed to fetch Google profile");
    }

    const profileData = await profileResponse.json();
    const { email, name, given_name, picture } = profileData;

    if (!email) {
      throw new Error("Google profile did not return an email address");
    }

    const normalizedEmail = email.toLowerCase().trim();
    console.log(`[AUTH] Google Sign-In attempt for: ${normalizedEmail}`);

    // 3. Find or Create User in Supabase Auth
    let userId: string;
    const { data: existingAuth, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    const authUser = existingAuth?.users.find((u) => u.email === normalizedEmail);

    if (authUser) {
      userId = authUser.id;
      // Mark email as verified if it wasn't already
      if (!authUser.email_confirmed_at) {
        await supabaseAdmin.auth.admin.updateUserById(userId, { user_metadata: { email_verified: true } });
      }
    } else {
      console.log(`[AUTH] Creating new auth user via Google for: ${normalizedEmail}`);
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        email_confirm: true,
        user_metadata: { name: name || given_name, avatar_url: picture },
        password: Math.random().toString(36).slice(-16), // strong random password since they use Google
      });

      if (authError || !authData.user) {
        throw new Error(`Failed to create auth user: ${authError?.message}`);
      }
      userId = authData.user.id;
    }

    // 4. Ensure profile exists in public.users table (upsert)
    const { error: profileError } = await supabaseAdmin.from("users").upsert(
      {
        id: userId,
        email: normalizedEmail,
        name: name || given_name || normalizedEmail.split("@")[0],
        email_verified: true,
        role: "buyer",
        plain_password: "GOOGLE_OAUTH",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    if (profileError) {
      console.error(`[AUTH] Warning: Error ensuring profile for ${userId}:`, profileError);
    }

    // 5. Generate a magic link to establish an SSR session cookies
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: normalizedEmail,
    });

    if (linkError || !linkData?.properties?.email_otp) {
      throw Error(linkError?.message || "Failed to generate session link");
    }

    const emailOtp = linkData.properties.email_otp;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const verifyRes = await fetch(`${supabaseUrl}/auth/v1/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseAnonKey,
      },
      body: JSON.stringify({ email: normalizedEmail, token: emailOtp, type: "email" }),
    });

    if (!verifyRes.ok) {
      throw new Error("Failed to exchange magic link for session");
    }

    const sessionData = await verifyRes.json();
    const { access_token, refresh_token } = sessionData;

    // 6. Set session cookies via SSR client
    const supabase = await createClient();
    const { error: setSessionError } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    });

    if (setSessionError) {
      throw new Error(setSessionError.message);
    }

    console.log(`[AUTH] Custom Google OAuth successful for ${normalizedEmail}`);
    
    // 7. Redirect to dashboard
    return NextResponse.redirect(`${baseUrl}/dashboard`);

  } catch (error: any) {
    console.error(`[AUTH] Google OAuth error:`, error);
    return NextResponse.redirect(
      `${baseUrl}/?error=${encodeURIComponent(error.message || "Authentication failed")}`
    );
  }
}
