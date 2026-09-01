import { NextResponse } from "next/server";
import { createClient, supabaseAdmin } from "@/lib/supabase-server";
import { sendPushToAdmins } from "@/lib/push-notifications";

export async function GET(request: Request) {
  try {
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

    const { data, error } = await supabase
      .from("deposits")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Deposits fetch error:", error);
    return NextResponse.json(
      { message: error.message || "Failed to fetch deposits" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    
    // 1. Create deposit record
    const { data: depositData, error } = await supabase
      .from("deposits")
      .insert({
        ...body,
        user_id: user.id,
        user_email: user.email,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;

    // 2. Create pending transaction record using admin to bypass RLS
    const { error: txError } = await supabaseAdmin
      .from("transactions")
      .insert({
        user_id: user.id,
        symbol: body.currency === 'BTC' ? 'BTC' : 'USDT',
        type: 'deposit',
        amount: body.amount,
        price: 1, // Deposit is 1:1 cash value equivalent
        total_value: body.amount,
        status: 'pending',
      });
      
    if (txError) {
       console.error("Failed to create pending transaction", txError);
    }

    try {
        await sendPushToAdmins({
            title: "New Deposit Submitted",
            body: `${user.email} submitted a deposit of ${body.amount} ${body.currency}.`,
            url: "/admin?tab=deposits"
        });
    } catch (e) {
        console.error("Failed to notify admins", e);
    }

    return NextResponse.json(depositData);
  } catch (error: any) {
    console.error("Deposit submission error:", error);
    return NextResponse.json(
      { message: error.message || "Failed to submit deposit" },
      { status: 500 }
    );
  }
}
