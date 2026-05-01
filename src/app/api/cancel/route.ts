import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  const { orderId, buyerId } = await req.json();
  if (!orderId || !buyerId) {
    return NextResponse.json({ error: "필수 파라미터가 누락되었습니다." }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  await supabase
    .from("orders")
    .update({ payment_status: "canceled" })
    .eq("order_id", orderId)
    .eq("buyer_id", buyerId)
    .eq("payment_status", "pending");

  return NextResponse.json({ success: true });
}
