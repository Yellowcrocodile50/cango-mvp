import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isFreeCategory } from "@/data/categories";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  _request: NextRequest,
  { params }: { params: { materialId: string } }
) {
  const { data: material, error } = await supabaseAdmin
    .from("materials")
    .select("file_url, category")
    .eq("id", params.materialId)
    .eq("is_deleted", false)
    .maybeSingle();

  if (error || !material) {
    return NextResponse.json({ error: "자료를 찾을 수 없습니다." }, { status: 404 });
  }

  if (!isFreeCategory(material.category)) {
    return NextResponse.json({ error: "무료 자료가 아닙니다." }, { status: 403 });
  }

  if (!material.file_url) {
    return NextResponse.json({ error: "파일이 없습니다." }, { status: 404 });
  }

  const { data: signedData, error: signedError } = await supabaseAdmin.storage
    .from("materials")
    .createSignedUrl(material.file_url, 3600);

  if (signedError || !signedData) {
    return NextResponse.json({ error: "다운로드 링크 생성에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({ signedUrl: signedData.signedUrl });
}
