import { NextResponse } from "next/server";
import { createClient, supabaseAdmin } from "@/lib/supabase-server";
import webpush from "web-push";

// Configure vapid keys from env
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY!;

webpush.setVapidDetails(
  "mailto:support@kali.com",
  vapidPublicKey,
  vapidPrivateKey
);

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { target, title, body } = await request.json();

    if (!target || !title || !body) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    let subscriptions = [];

    if (target === "all") {
      const { data, error } = await supabaseAdmin
        .from("push_subscriptions")
        .select("*");
      if (error) throw error;
      subscriptions = data || [];
    } else {
      const { data, error } = await supabaseAdmin
        .from("push_subscriptions")
        .select("*")
        .eq("user_id", target);
      if (error) throw error;
      subscriptions = data || [];
    }

    if (subscriptions.length === 0) {
      return NextResponse.json({ message: "No active subscriptions found for target" }, { status: 200 });
    }

    const payload = JSON.stringify({
      title,
      body,
      icon: "/icon.png",
      badge: "/icon.png",
      data: {
        url: "/notifications"
      }
    });

    const sendPromises = subscriptions.map(async (sub: any) => {
      try {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            auth: sub.auth_key,
            p256dh: sub.p256dh_key,
          },
        };

        await webpush.sendNotification(pushSubscription as any, payload);
      } catch (err: any) {
        if (err.statusCode === 404 || err.statusCode === 410) {
           // Subscription has expired or is no longer valid
           await supabaseAdmin
             .from("push_subscriptions")
             .delete()
             .eq("id", sub.id);
        }
        console.error("Push notification error:", err);
      }
    });

    await Promise.all(sendPromises);

    return NextResponse.json({ success: true, count: subscriptions.length });
  } catch (error: any) {
    console.error("Send notification error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to send notifications" },
      { status: 500 }
    );
  }
}
