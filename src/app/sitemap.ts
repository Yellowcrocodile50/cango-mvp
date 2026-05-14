import { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

const BASE_URL = "https://www.cango.kr";

// 사이트맵은 매 요청마다 fresh 생성 — 신규 자료 즉시 반영
// 크롤러 요청 빈도 낮아 Supabase 호출 부담 미미
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // materials 테이블에는 updated_at 컬럼 없음 → created_at 사용
  const { data: materials, error } = await supabase
    .from("materials")
    .select("id, created_at")
    .eq("is_deleted", false);

  if (error) {
    console.error("[sitemap] materials 쿼리 실패:", error);
  }

  const productPages: MetadataRoute.Sitemap = (materials ?? []).map((m) => ({
    url: `${BASE_URL}/product/${m.id}`,
    lastModified: m.created_at ? new Date(m.created_at) : new Date(),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  // login/signup은 색인 노출 불필요 → 각 페이지 layout에서 noindex 처리. 사이트맵에서도 제외.
  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    ...productPages,
  ];
}
