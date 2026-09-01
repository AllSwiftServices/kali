import { NextResponse } from "next/server";
import { createClient, supabaseAdmin } from "@/lib/supabase-server";
import { sendPushNotification } from "@/lib/push-notifications";

// PATCH /api/withdrawals/[id] — Admin processes a withdrawal
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { status, admin_feedback } = await request.json();

    if (!['approved', 'rejected'].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    // Get current withdrawal record
    const { data: withdrawal, error: fetchError } = await supabaseAdmin
      .from("withdrawals")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !withdrawal) {
      return NextResponse.json({ error: "Withdrawal not found" }, { status: 404 });
    }

    if (withdrawal.status !== 'pending') {
      return NextResponse.json({ error: "Withdrawal already processed" }, { status: 400 });
    }

    // 1. Update Withdrawal Record
    const { data: updatedWithdrawal, error: updateError } = await supabaseAdmin
      .from("withdrawals")
      .update({
        status,
        admin_feedback,
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) throw updateError;

    // 2. If Rejected, Refund Balance
    if (status === 'rejected') {
      const { data: wallet } = await supabaseAdmin.from("wallets").select("main_balance").eq("id", withdrawal.wallet_id).single();
      if (wallet) {
        await supabaseAdmin
          .from("wallets")
          .update({ 
            main_balance: Number(wallet.main_balance) + Number(withdrawal.amount),
            updated_at: new Date().toISOString()
          })
          .eq("id", withdrawal.wallet_id);
      }
      
      // Update transaction status
      await supabaseAdmin
        .from("transactions")
        .update({ status: 'failed' })
        .eq("user_id", withdrawal.user_id)
        .like("description", `%(${withdrawal.id})%`);
    } else {
      // Update transaction status to completed
      await supabaseAdmin
        .from("transactions")
        .update({ status: 'completed' })
        .eq("user_id", withdrawal.user_id)
        .like("description", `%(${withdrawal.id})%`);
    }

    // 3. Notify User
    const title = status === 'approved' ? "Withdrawal Approved" : "Withdrawal Rejected";
    const body = status === 'approved' 
      ? `Your withdrawal of $${Number(withdrawal.amount).toLocaleString()} has been processed.`
      : `Your withdrawal of $${Number(withdrawal.amount).toLocaleString()} was rejected: ${admin_feedback || 'No reason provided'}. Your funds have been refunded.`;

    await sendPushNotification(withdrawal.user_id, {
      title,
      body,
      url: "/wallet"
    });

    return NextResponse.json(updatedWithdrawal);
  } catch (error: any) {
    console.error("Withdrawal update error:", error);
    return NextResponse.json({ message: error.message || "Failed to update withdrawal" }, { status: 500 });
  }
}
