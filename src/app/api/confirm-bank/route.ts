import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  const { orderId } = await req.json();
  if (!orderId) {
    return NextResponse.json({ error: "필수 파라미터가 누락되었습니다." }, { status: 400 });
  }

  // 요청자의 세션 토큰으로 role 확인 (supplier만 허용)
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const token = authHeader.replace("Bearer ", "");

  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  // supplier 권한 확인
  const { data: profile } = await anonClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "supplier") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  // service_role로 주문 상태 업데이트
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: orders, error: fetchError } = await adminClient
    .from("orders")
    .select("id, payment_status, payment_method")
    .eq("order_id", orderId)
    .eq("payment_status", "pending")
    .eq("payment_method", "bank_transfer");

  if (fetchError || !orders || orders.length === 0) {
    return NextResponse.json({ error: "확인할 수 있는 주문이 없습니다." }, { status: 400 });
  }

  const { error: updateError } = await adminClient
    .from("orders")
    .update({ payment_status: "done" })
    .eq("order_id", orderId)
    .eq("payment_method", "bank_transfer");

  if (updateError) {
    return NextResponse.json({ error: "상태 업데이트에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
