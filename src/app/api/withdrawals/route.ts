import { NextResponse } from "next/server";
import { createClient, supabaseAdmin } from "@/lib/supabase-server";
import { sendPushToAdmins } from "@/lib/push-notifications";

// GET /api/withdrawals — List withdrawals
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single();
    const isAdmin = profile?.role === "admin";

    // Fetch withdrawals
    const { data: withdrawals, error: withdrawalsError } = await supabaseAdmin
      .from("withdrawals")
      .select("*")
      .order("created_at", { ascending: false });

    if (withdrawalsError) throw withdrawalsError;

    let filteredWithdrawals = withdrawals || [];
    
    // Users only see their own withdrawals
    if (!isAdmin) {
      filteredWithdrawals = filteredWithdrawals.filter(w => w.user_id === user.id);
    }

    if (filteredWithdrawals.length === 0) {
      return NextResponse.json([]);
    }

    // Fetch users for these withdrawals to perform manual join
    const userIds = Array.from(new Set(filteredWithdrawals.map(w => w.user_id)));
    const { data: usersData, error: usersError } = await supabaseAdmin
      .from("users")
      .select("id, email, name")
      .in("id", userIds);

    if (usersError) {
      console.error("Failed to fetch users for withdrawals join:", usersError);
      // Still return withdrawals even if user data fetch fails
      return NextResponse.json(filteredWithdrawals);
    }

    const userMap = new Map(usersData?.map(u => [u.id, u]));

    // Merge user data into withdrawals
    const enrichedWithdrawals = filteredWithdrawals.map(w => ({
      ...w,
      users: userMap.get(w.user_id) || null
    }));

    return NextResponse.json(enrichedWithdrawals);
  } catch (error: any) {
    console.error("Withdrawals fetch error:", error);
    return NextResponse.json({ message: error.message || "Failed to fetch withdrawals" }, { status: 500 });
  }
}

// POST /api/withdrawals — User requests a withdrawal
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Check KYC Status
    const { data: kyc } = await supabaseAdmin.from("kyc").select("status").eq("user_id", user.id).single();
    if (kyc?.status !== 'approved') {
      return NextResponse.json({ error: "KYC verification required for withdrawals" }, { status: 403 });
    }

    const body = await request.json();
    const { wallet_id, amount, currency, network, address } = body;

    if (!wallet_id || !amount || !currency || !network || !address) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const withdrawAmount = Number(amount);
    if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
      return NextResponse.json({ error: "Invalid withdrawal amount" }, { status: 400 });
    }

    // 2. Check Wallet and Balance
    const { data: wallet, error: walletError } = await supabaseAdmin
      .from("wallets")
      .select("*")
      .eq("id", wallet_id)
      .eq("user_id", user.id)
      .single();

    if (walletError || !wallet) {
      return NextResponse.json({ error: "Wallet not found" }, { status: 404 });
    }

    if (Number(wallet.main_balance) < withdrawAmount) {
      return NextResponse.json({ error: "Insufficient balance" }, { status: 400 });
    }

    // 3. Perform Transaction (Atomic-ish)
    // Deduction
    const { error: deductError } = await supabaseAdmin
      .from("wallets")
      .update({ 
        main_balance: Number(wallet.main_balance) - withdrawAmount,
        updated_at: new Date().toISOString()
      })
      .eq("id", wallet.id);

    if (deductError) throw deductError;

    // Create Withdrawal Record
    const { data: withdrawal, error: withdrawError } = await supabaseAdmin
      .from("withdrawals")
      .insert({
        user_id: user.id,
        wallet_id: wallet.id,
        amount: withdrawAmount,
        currency,
        network,
        address,
        status: 'pending'
      })
      .select()
      .single();

    if (withdrawError) {
      // Rollback balance (simplified)
      await supabaseAdmin.from("wallets").update({ main_balance: wallet.main_balance }).eq("id", wallet.id);
      throw withdrawError;
    }

    // 4. Log Transaction
    const { error: txError } = await supabaseAdmin.from("transactions").insert({
      user_id: user.id,
      type: 'withdraw',
      amount: -withdrawAmount, // Important: Withdrawal is a negative flow
      symbol: currency,
      price: 1, // Add price to match deposit logic and avoid potential null errors
      total_value: withdrawAmount,
      status: 'pending',
      description: `Withdrawal request (${withdrawal.id})`
    });

    if (txError) {
      console.error("Failed to log withdrawal transaction:", txError);
      // We don't necessarily want to fail the whole request if just logging failed,
      // but in this case, the user's history is important.
    }

    // 5. Notify Admins
    await sendPushToAdmins({
      title: "New Withdrawal Request",
      body: `${user.email} requested to withdraw $${withdrawAmount.toLocaleString()} in ${currency}.`,
      url: "/admin?tab=withdrawals"
    });

    return NextResponse.json(withdrawal);
  } catch (error: any) {
    console.error("Withdrawal request error:", error);
    return NextResponse.json({ message: error.message || "Failed to submit withdrawal request" }, { status: 500 });
  }
}
