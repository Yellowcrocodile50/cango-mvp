import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  const { paymentId } = await req.json();

  if (!paymentId) {
    return NextResponse.json({ error: "필수 파라미터가 누락되었습니다." }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // DB에 저장된 금액 조회
  const { data: orders } = await supabase
    .from("orders")
    .select("amount, material_id")
    .eq("order_id", paymentId)
    .eq("payment_status", "pending");

  if (!orders || orders.length === 0) {
    return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 400 });
  }

  const dbTotal = orders.reduce((sum, o) => sum + o.amount, 0);

  // 포트원 V2 결제 단건 조회 (금액 위변조 검증)
  const portoneRes = await fetch(
    `https://api.portone.io/payments/${encodeURIComponent(paymentId)}`,
    {
      headers: {
        Authorization: `PortOne ${process.env.PORTONE_API_SECRET}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!portoneRes.ok) {
    return NextResponse.json({ error: "결제 정보 조회에 실패했습니다." }, { status: 500 });
  }

  const portonePayment = await portoneRes.json();

  // 결제 상태 검증
  if (portonePayment.status !== "PAID") {
    await supabase
      .from("orders")
      .update({ payment_status: "canceled" })
      .eq("order_id", paymentId)
      .eq("payment_status", "pending");
    return NextResponse.json({ error: "결제가 완료되지 않았습니다." }, { status: 400 });
  }

  // 금액 위변조 검증
  if (portonePayment.amount?.total !== dbTotal) {
    await supabase
      .from("orders")
      .update({ payment_status: "canceled" })
      .eq("order_id", paymentId)
      .eq("payment_status", "pending");
    return NextResponse.json({ error: "결제 금액이 일치하지 않습니다." }, { status: 400 });
  }

  // 결제 완료 상태로 업데이트
  await supabase
    .from("orders")
    .update({ payment_status: "done", payment_key: paymentId })
    .eq("order_id", paymentId);

  const materialIds = orders.map((o) => o.material_id);
  return NextResponse.json({ success: true, materialIds });
}
