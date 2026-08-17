import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { liveTools, TOOLS_HUB_PATH } from "@/data/tools";

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
  // 도구는 레지스트리에서 자동으로 끌어온다. 예전에 /naeshin이 사이트맵에서 빠진 채로
  // 한동안 방치된 적이 있어서, 도구를 추가할 때 여기를 손대야 하는 구조를 없앴다.
  const toolPages: MetadataRoute.Sitemap = liveTools.map((t) => ({
    url: `${BASE_URL}/${t.slug}`,
    changeFrequency: "monthly",
    priority: t.priority,
  }));

  return [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 },
    ...toolPages,
    { url: `${BASE_URL}${TOOLS_HUB_PATH}`, changeFrequency: "monthly", priority: 0.7 },
    ...productPages,
  ];
}
