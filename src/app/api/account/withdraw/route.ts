import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  const { password } = await req.json();

  if (!password || typeof password !== "string") {
    return NextResponse.json({ error: "비밀번호를 입력해주세요." }, { status: 400 });
  }

  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAdmin = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user || !user.email) {
    return NextResponse.json({ error: "인증에 실패했습니다." }, { status: 401 });
  }

  // 공급자 판별은 profiles.role로 한다. user_metadata는 사용자가 스스로 고칠 수 있어
  // 차단을 우회할 수 있고, 우회되면 materials가 auth.users에 ON DELETE CASCADE로
  // 묶여 있어 자료 전체가 함께 지워진다.
  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json(
      { error: "계정 정보 확인 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }

  if (profile?.role === "supplier") {
    return NextResponse.json(
      { error: "공급자 계정은 고객센터를 통해서만 탈퇴할 수 있습니다." },
      { status: 403 }
    );
  }

  const verifyClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
  const { error: passwordError } = await verifyClient.auth.signInWithPassword({
    email: user.email,
    password,
  });
  if (passwordError) {
    return NextResponse.json({ error: "비밀번호가 일치하지 않습니다." }, { status: 401 });
  }

  const { data: pendingOrders, error: pendingError } = await supabaseAdmin
    .from("orders")
    .select("id")
    .eq("buyer_id", user.id)
    .eq("payment_status", "done")
    .eq("is_sent", false)
    .gt("amount", 0)
    .limit(1);

  if (pendingError) {
    return NextResponse.json(
      { error: "주문 상태 확인 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }

  if (pendingOrders && pendingOrders.length > 0) {
    return NextResponse.json(
      {
        error:
          "발송 대기 중인 주문이 있어 탈퇴할 수 없습니다. 발송 완료 후 다시 시도해주세요.",
        code: "PENDING_ORDERS",
      },
      { status: 409 }
    );
  }

  const { error: anonymizeError } = await supabaseAdmin
    .from("orders")
    .update({
      buyer_email: `deleted-${user.id}@anonymized.local`,
      buyer_phone: null,
    })
    .eq("buyer_id", user.id);

  if (anonymizeError) {
    return NextResponse.json(
      { error: "개인정보 익명화 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }

  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    return NextResponse.json(
      { error: "계정 삭제 중 오류가 발생했습니다: " + deleteError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
