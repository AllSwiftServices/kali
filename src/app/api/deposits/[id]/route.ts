import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { sendPushNotification } from "@/lib/push-notifications";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const id = (await params).id;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Role check
    const { data: profile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { status, rejection_reason } = await request.json();

    // 1. Fetch the deposit to get user_id and amount
    const { data: deposit, error: fetchError } = await supabase
      .from("deposits")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !deposit) {
      return NextResponse.json({ error: "Deposit not found" }, { status: 404 });
    }

    if (deposit.status !== 'pending') {
      return NextResponse.json({ error: "Deposit already processed" }, { status: 400 });
    }

    // 2. Update deposit status
    const { error: updateError } = await supabase
      .from("deposits")
      .update({
        status,
        rejection_reason,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) throw updateError;

    // Reject the pending transaction if deposit is rejected
    if (status === 'rejected') {
        const { data: existingTx } = await supabase
          .from("transactions")
          .select("id")
          .eq("user_id", deposit.user_id)
          .eq("type", "deposit")
          .eq("status", "pending")
          .eq("amount", deposit.amount)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();
          
        if (existingTx) {
          await supabase
            .from("transactions")
            .update({ status: 'failed' })
            .eq("id", existingTx.id);
        }
    }

      // 3. If approved, update wallet balance and confirm transaction
    if (status === 'approved') {
      const targetWallet = deposit.wallet_type || 'trading';
      
      // Get current wallet
      const { data: wallet, error: walletError } = await supabase
        .from("wallets")
        .select("*")
        .eq("user_id", deposit.user_id)
        .eq("currency", targetWallet) 
        .single();

      if (walletError && walletError.code !== 'PGRST116') throw walletError;

      const newBalance = (wallet?.main_balance || 0) + Number(deposit.amount);
      const newAvailable = (wallet?.available_balance || 0) + Number(deposit.amount);

      if (wallet) {
        const { error: walletUpdateError } = await supabase
          .from("wallets")
          .update({
            main_balance: newBalance,
            available_balance: newAvailable,
            updated_at: new Date().toISOString(),
          })
          .eq("id", wallet.id);
        if (walletUpdateError) throw walletUpdateError;
      } else {
        const { error: walletInsertError } = await supabase
          .from("wallets")
          .insert({
            user_id: deposit.user_id,
            currency: targetWallet,
            main_balance: newBalance,
            available_balance: newAvailable,
          });
        if (walletInsertError) throw walletInsertError;
      }

      // Find and update pending transaction, or create if missing
      const { data: existingTx } = await supabase
        .from("transactions")
        .select("id")
        .eq("user_id", deposit.user_id)
        .eq("type", "deposit")
        .eq("status", "pending")
        .eq("amount", deposit.amount)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (existingTx) {
          const { error: txError } = await supabase
            .from("transactions")
            .update({ status: 'completed' })
            .eq("id", existingTx.id);
          if (txError) throw txError;
      } else {
          // Fallback if not found (e.g. for deposits created before this update)
          const { error: txError } = await supabase
            .from("transactions")
            .insert({
              user_id: deposit.user_id,
              symbol: deposit.currency === 'BTC' ? 'BTC' : 'USDT',
              type: 'deposit',
              amount: deposit.amount,
              price: 1, // Deposit is cash-in
              total_value: deposit.amount,
              status: 'completed',
            });
          if (txError) throw txError;
      }
    }

    try {
      await sendPushNotification(deposit.user_id, {
        title: status === 'approved' ? "Deposit Approved! 💰" : "Deposit Update",
        body: status === 'approved'
            ? `Your deposit of ${deposit.amount} ${deposit.currency} has been approved and credited to your ${deposit.wallet_type || 'trading'} wallet.`
            : `Your deposit was rejected. Reason: ${rejection_reason || 'See transaction history for details.'}`,
        url: "/wallet"
      });
    } catch (pushErr) {
      console.error("Push notification error:", pushErr);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Deposit update error:", error);
    return NextResponse.json(
      { message: error.message || "Failed to update deposit" },
      { status: 500 }
    );
  }
}
// POST is an alias for PATCH to support simpler admin clients
export { PATCH as POST };
