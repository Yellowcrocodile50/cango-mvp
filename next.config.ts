import type { NextConfig } from "next";

// next.config 평가 시점에 .env가 로드돼 있다는 보장이 없어 상수를 폴백으로 둔다.
// (여기서 throw하면 빌드 자체가 깨진다)
const SUPABASE_HOST = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : "yqnbsiqypgighfezsuul.supabase.co";

const nextConfig: NextConfig = {
  images: {
    // 썸네일·미리보기는 Supabase 스토리지(public/thumbnails)에서 온다.
    // next/image를 거치면 Vercel이 리사이즈해 대신 서빙하므로,
    // 원본(평균 398KB)이 매 조회마다 Supabase egress를 태우는 일이 사라진다.
    remotePatterns: [
      {
        protocol: "https",
        hostname: SUPABASE_HOST,
        pathname: "/storage/v1/object/public/thumbnails/**",
      },
    ],
    // 파일명에 업로드 타임스탬프가 박혀 있어 이미지가 바뀌면 URL도 바뀐다.
    // 같은 URL은 사실상 불변이므로 기본값(4시간)보다 길게 잡아 원본 재요청을 줄인다.
    minimumCacheTTL: 2678400, // 31일
  },
};

export default nextConfig;
