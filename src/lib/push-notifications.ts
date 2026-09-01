import webpush from "web-push";
import { supabaseAdmin } from "@/lib/supabase-server";

// Configure web-push with VAPID keys
if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.NEXT_PUBLIC_VAPID_SUBJECT || "mailto:support@kali.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

export async function sendPushNotification(
  userId: string,
  payload: PushPayload,
): Promise<{ success: boolean; sentCount: number; message: string }> {
  try {
    // 1. Get user's subscriptions
    const { data: subscriptions, error } = await supabaseAdmin
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", userId);

    // Save to notification history (always, even if no push subs)
    try {
      await supabaseAdmin.from("notifications").insert({
        user_id: userId,
        title: payload.title,
        body: payload.body,
        url: payload.url,
        is_read: false,
      });
    } catch (dbError) {
      console.error("Failed to save notification to history:", dbError);
    }

    if (error) {
      console.error("Database error fetching subscriptions:", error);
      return {
        success: false,
        sentCount: 0,
        message: "Database error: " + error.message,
      };
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log("No push subscriptions found for user", userId);
      return {
        success: false,
        sentCount: 0,
        message:
          "No active push subscriptions found. Try disabling and re-enabling notifications.",
      };
    }

    console.log(
      `Sending push to ${subscriptions.length} endpoints for user ${userId}`,
    );

    // 2. Send to all endpoints
    let sentCount = 0;
    const promises = subscriptions.map(async (sub) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          auth: sub.auth_key,
          p256dh: sub.p256dh_key,
        },
      };

      try {
        console.log(
          `[PUSH DEBUG] Attempting send to endpoint: ${sub.endpoint.substring(0, 30)}...`,
        );
        const result = await webpush.sendNotification(
          pushSubscription,
          JSON.stringify(payload),
        );
        console.log(
          `[PUSH DEBUG] Successfully sent! Status code: ${result.statusCode}`,
        );
        sentCount++;
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          // Subscription has expired or is no longer valid, delete it
          console.log("[PUSH DEBUG] Cleaning up expired subscription", sub.id);
          await supabaseAdmin.from("push_subscriptions").delete().eq("id", sub.id);
        } else {
          console.error(
            "[PUSH DEBUG] Error sending push:",
            err.statusCode,
            err.message,
          );
          if (err.body) console.log("[PUSH DEBUG] Error body:", err.body);
        }
      }
    });

    await Promise.all(promises);

    if (sentCount === 0) {
      return {
        success: false,
        sentCount: 0,
        message: "Failed to send to any endpoints (likely expired).",
      };
    }

    return {
      success: true,
      sentCount,
      message: `Sent to ${sentCount} devices.`,
    };
  } catch (e: any) {
    console.error("Failed to send push notification", e);
    return {
      success: false,
      sentCount: 0,
      message: "Internal Error: " + e.message,
    };
  }
}

export async function sendPushToAdmins(
    payload: PushPayload,
): Promise<{ success: boolean; sentCount: number; message: string }> {
    try {
        // Find all admin users
        const { data: admins, error: adminError } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('role', 'admin');

        if (adminError || !admins || admins.length === 0) {
            console.log("No admins found or error fetching admins");
            return { success: false, sentCount: 0, message: "No admins found." };
        }

        let totalSent = 0;
        const promises = admins.map(async (admin) => {
           const result = await sendPushNotification(admin.id, payload);
           if (result.success) {
               totalSent += result.sentCount;
           }
        });

        await Promise.all(promises);

        return {
            success: true,
            sentCount: totalSent,
            message: `Sent to ${totalSent} admin devices.`,
        };
    } catch (e: any) {
        console.error("Failed to send push to admins", e);
        return {
            success: false,
            sentCount: 0,
            message: "Internal Error: " + e.message,
        };
    }
}
