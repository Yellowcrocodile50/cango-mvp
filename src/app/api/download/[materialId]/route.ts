import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isFreeCategory } from "@/data/categories";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ materialId: string }> }
) {
  const { materialId } = await params;

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const authHeader = request.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const { data: { user } } = token
    ? await supabaseAdmin.auth.getUser(token)
    : { data: { user: null } };

  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  /* 무료라도 마이페이지에 등록(무료 주문)한 사람만 받는다 — 자료 ID만 알면
     가입 없이 받아가던 구멍을 막는다. */
  const { data: owned } = await supabaseAdmin
    .from("orders")
    .select("id")
    .eq("buyer_id", user.id)
    .eq("material_id", materialId)
    .eq("payment_status", "done")
    .limit(1)
    .maybeSingle();

  if (!owned) {
    return NextResponse.json({ error: "마이페이지에 등록된 자료가 아닙니다." }, { status: 403 });
  }

  const { data: material, error: dbError } = await supabaseAdmin
    .from("materials")
    .select("file_url, category, title")
    .eq("id", materialId)
    .eq("is_deleted", false)
    .maybeSingle();

  if (dbError) {
    console.error("[download] DB error:", dbError.message);
    return NextResponse.json({ error: "DB 오류: " + dbError.message }, { status: 500 });
  }

  if (!material) {
    return NextResponse.json({ error: "자료를 찾을 수 없습니다." }, { status: 404 });
  }

  if (!isFreeCategory(material.category)) {
    return NextResponse.json({ error: "무료 자료가 아닙니다." }, { status: 403 });
  }

  if (!material.file_url) {
    return NextResponse.json({ error: "파일이 등록되어 있지 않습니다." }, { status: 404 });
  }

  const { data: signedData, error: signedError } = await supabaseAdmin.storage
    .from("materials")
    .createSignedUrl(material.file_url, 3600);

  if (signedError || !signedData) {
    console.error("[download] signed URL error:", signedError?.message);
    return NextResponse.json({ error: "스토리지 오류: " + signedError?.message }, { status: 500 });
  }

  await supabaseAdmin
    .from("orders")
    .update({ first_downloaded_at: new Date().toISOString() })
    .eq("buyer_id", user.id)
    .eq("material_id", materialId)
    .eq("payment_status", "done")
    .is("first_downloaded_at", null);

  return NextResponse.json({ signedUrl: signedData.signedUrl });
}
