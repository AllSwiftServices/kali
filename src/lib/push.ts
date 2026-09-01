import webpush from 'web-push';
import { supabaseAdmin } from '@/lib/supabase-server';

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY!;
const vapidEmail = process.env.VAPID_EMAIL || 'mailto:support@kali.com';

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);
}

export async function sendPushToUser(userId: string, payload: { title: string; body: string; url?: string }) {
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.warn('[Push] VAPID keys not configured, skipping push');
    return;
  }

  try {
    const { data: subs, error } = await supabaseAdmin
      .from('push_subscriptions')
      .select('endpoint, auth_key, p256dh_key')
      .eq('user_id', userId);

    if (error || !subs?.length) {
      // Even if no push subs, we still save to notification history
      console.log(`[Push] No subscriptions for ${userId}, but saving to history`);
    }

    // Save to notification history
    try {
      await supabaseAdmin.from('notifications').insert({
        user_id: userId,
        title: payload.title,
        body: payload.body,
        url: payload.url || '/profile/chat',
        is_read: false,
      });
    } catch (dbError) {
      console.error('[Push] Failed to save notification to history:', dbError);
    }

    if (!subs?.length) return;

    const notification = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url || '/profile/chat',
      icon: '/icon.png',
    });

    await Promise.allSettled(
      subs.map((sub) =>
        webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { auth: sub.auth_key, p256dh: sub.p256dh_key },
          },
          notification
        ).catch((err) => {
          // Remove expired/invalid subscriptions automatically
          if (err.statusCode === 404 || err.statusCode === 410) {
            supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
          }
        })
      )
    );
  } catch (err) {
    console.error('[Push] sendPushToUser error:', err);
  }
}
