import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isFreeCategory } from "@/data/categories";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ materialId: string }> }
) {
  const { materialId } = await params;

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: material, error: dbError } = await supabaseAdmin
    .from("materials")
    .select("file_url, category")
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

  return NextResponse.json({ signedUrl: signedData.signedUrl });
}
