import { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

const BASE_URL = "https://www.cango.kr";

// 1시간 단위로 재생성 — 크롤러 반복 요청 시 Supabase 쿼리 캐시
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: materials } = await supabase
    .from("materials")
    .select("id, updated_at")
    .eq("is_deleted", false);

  const productPages: MetadataRoute.Sitemap = (materials ?? []).map((m) => ({
    url: `${BASE_URL}/product/${m.id}`,
    lastModified: m.updated_at ? new Date(m.updated_at) : new Date(),
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
