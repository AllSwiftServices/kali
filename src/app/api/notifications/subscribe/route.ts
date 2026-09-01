import { NextResponse } from 'next/server';
import { createClient, supabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, endpoint, authKey, p256dhKey } = body;

    if (!endpoint) {
      return NextResponse.json({ success: false, error: 'Endpoint is required' }, { status: 400 });
    }

    if (action === 'subscribe') {
      if (!authKey || !p256dhKey) {
        return NextResponse.json({ success: false, error: 'Missing subscription keys' }, { status: 400 });
      }

      // Upsert the subscription
      const { error } = await supabaseAdmin
        .from('push_subscriptions')
        .upsert({
          user_id: user.id,
          endpoint,
          auth_key: authKey,
          p256dh_key: p256dhKey,
          updated_at: new Date().toISOString()
        }, { onConflict: 'endpoint' });

      if (error) throw error;
      
      return NextResponse.json({ success: true, message: 'Subscribed' });
    } 
    
    if (action === 'unsubscribe') {
      const { error } = await supabaseAdmin
        .from('push_subscriptions')
        .delete()
        .match({ endpoint, user_id: user.id });

      if (error) throw error;

      return NextResponse.json({ success: true, message: 'Unsubscribed' });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Push subscription API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
