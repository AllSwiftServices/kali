import { NextResponse } from "next/server";
import { createClient, supabaseAdmin } from "@/lib/supabase-server";
import { sendGeneralEmail } from "@/lib/email";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Role check: Only admin can send emails
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { target, name: customName, subject, body } = await request.json();

    if (!target || !subject || !body) {
      return NextResponse.json({ error: "Missing required fields (target, subject, body)" }, { status: 400 });
    }

    let recipients: { email: string; name: string | null }[] = [];

    if (target === "all") {
      const { data, error } = await supabaseAdmin
        .from("users")
        .select("email, name");
      if (error) throw error;
      recipients = data || [];
    } else if (target.includes("@")) {
      recipients = [{ email: target.trim(), name: customName ? customName.trim() : target.trim().split("@")[0] }];
    } else {
      const { data, error } = await supabaseAdmin
        .from("users")
        .select("email, name")
        .eq("id", target)
        .maybeSingle();
      
      if (error) throw error;
      if (data) {
        recipients = [{
          email: data.email,
          name: customName ? customName.trim() : (data.name || data.email.split("@")[0])
        }];
      }
    }

    if (recipients.length === 0) {
      return NextResponse.json({ message: "No recipients found for the selected target" }, { status: 404 });
    }

    let sentCount = 0;
    const sendErrors: string[] = [];

    // Send emails sequentially or in chunks to avoid SMTP server limits
    for (const recipient of recipients) {
      try {
        if (!recipient.email) continue;
        const name = recipient.name || recipient.email.split("@")[0];
        await sendGeneralEmail(recipient.email, subject, body, name);
        sentCount++;
      } catch (err: any) {
        console.error(`Failed to send email to ${recipient.email}:`, err);
        sendErrors.push(`${recipient.email}: ${err.message}`);
      }
    }

    if (sendErrors.length > 0 && sentCount === 0) {
      return NextResponse.json({ error: "All email dispatches failed", details: sendErrors }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      count: sentCount,
      total: recipients.length,
      errors: sendErrors.length > 0 ? sendErrors : undefined 
    });

  } catch (error: any) {
    console.error("Admin send email api error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process email dispatch request" },
      { status: 500 }
    );
  }
}
