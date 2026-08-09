import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

const BASE_URL = "https://www.cango.kr";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: materials } = await supabase
    .from("materials")
    .select("id, created_at")
    .eq("is_deleted", false);

  const productPages: MetadataRoute.Sitemap = (materials ?? []).map((m) => ({
    url: `${BASE_URL}/product/${m.id}`,
    lastModified: m.created_at ? new Date(m.created_at) : new Date(),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  // /terms·/privacy는 의도적으로 제외한다. 두 페이지에 noindex를 걸었고(각 page.tsx),
  // 사이트맵에 남겨두면 색인하지 말라면서 수집하라는 모순된 신호를 준다.
  return [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 },
    { url: `${BASE_URL}/naeshin`, changeFrequency: "monthly", priority: 0.9 },
    ...productPages,
  ];
}
