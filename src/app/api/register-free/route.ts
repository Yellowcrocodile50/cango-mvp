import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isFreeCategory } from "@/data/categories";

export async function POST(req: NextRequest) {
  const { materialId } = await req.json();

  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: "인증에 실패했습니다." }, { status: 401 });
  }

  const [materialRes, existingRes] = await Promise.all([
    supabaseAdmin
      .from("materials")
      .select("category")
      .eq("id", materialId)
      .eq("is_deleted", false)
      .maybeSingle(),
    supabaseAdmin
      .from("orders")
      .select("id")
      .eq("buyer_id", user.id)
      .eq("material_id", materialId)
      .eq("payment_status", "done")
      .maybeSingle(),
  ]);

  if (!materialRes.data) {
    return NextResponse.json({ error: "자료를 찾을 수 없습니다." }, { status: 404 });
  }

  if (!isFreeCategory(materialRes.data.category)) {
    return NextResponse.json({ error: "무료 자료가 아닙니다." }, { status: 403 });
  }

  if (existingRes.data) {
    return NextResponse.json({ alreadyRegistered: true });
  }

  const orderId = `free-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const { error: insertError } = await supabaseAdmin.from("orders").insert({
    material_id: materialId,
    buyer_id: user.id,
    buyer_email: user.email,
    buyer_phone: null,
    amount: 0,
    payment_status: "done",
    order_id: orderId,
  });

  if (insertError) {
    return NextResponse.json({ error: "등록 중 오류가 발생했습니다: " + insertError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
