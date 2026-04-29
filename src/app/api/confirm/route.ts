import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  const { paymentKey, orderId, amount } = await req.json();

  if (!paymentKey || !orderId || !amount) {
    return NextResponse.json({ error: "필수 파라미터가 누락되었습니다." }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // DB에 저장된 금액과 실제 결제 금액 일치 여부 검증
  const { data: orders } = await supabase
    .from("orders")
    .select("amount, material_id")
    .eq("order_id", orderId)
    .eq("payment_status", "pending");

  if (!orders || orders.length === 0) {
    return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 400 });
  }

  const dbTotal = orders.reduce((sum, o) => sum + o.amount, 0);
  if (dbTotal !== amount) {
    return NextResponse.json({ error: "결제 금액이 일치하지 않습니다." }, { status: 400 });
  }

  // 토스 결제 승인 API 호출
  const encoded = Buffer.from(`${process.env.TOSS_SECRET_KEY}:`).toString("base64");
  const tossRes = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
    method: "POST",
    headers: {
      Authorization: `Basic ${encoded}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ paymentKey, orderId, amount }),
  });

  if (!tossRes.ok) {
    const err = await tossRes.json();
    await supabase
      .from("orders")
      .update({ payment_status: "canceled" })
      .eq("order_id", orderId)
      .eq("payment_status", "pending");
    return NextResponse.json({ error: err.message ?? "결제 승인에 실패했습니다." }, { status: tossRes.status });
  }

  // 결제 완료 상태로 업데이트
  await supabase
    .from("orders")
    .update({ payment_status: "done", payment_key: paymentKey })
    .eq("order_id", orderId);

  const materialIds = orders.map((o) => o.material_id);
  return NextResponse.json({ success: true, materialIds });
}
