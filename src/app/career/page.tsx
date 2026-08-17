import type { Metadata } from "next";
import { Suspense } from "react";
import CareerClient from "./CareerClient";

const CAREER_URL = "https://www.cango.kr/career";
// 네이버 검색결과 제목은 40~50자에서 잘리고 사이트명 접미사가 붙으므로 짧게 유지한다.
const CAREER_TITLE = "진로 탐구 · 학과 추천 — 나에게 맞는 학과 찾기";
// ⚠️ 학과 개수를 문구에 박지 않는다 — 데이터가 늘 때마다 어긋난다.
const CAREER_DESCRIPTION =
  "무료 학과 추천 - 좋아하는 과목과 관심사를 고르면 나에게 맞는 대학 학과를 찾아드려요. 성적을 넣지 않아도 되고 가입도 필요 없어서 중학생·고등학생 모두 볼 수 있어요. 의예과·간호학과·컴퓨터공학과부터 경영·심리·교육까지 이과·문과 학과의 소개와 졸업 후 진로, 학과별 등급컷까지 이어서 확인할 수 있습니다.";

export const metadata: Metadata = {
  title: CAREER_TITLE,
  description: CAREER_DESCRIPTION,
  keywords: [
    // "적성검사"는 넣지 않는다 — 이 도구는 검사가 아니라 관심사 매칭이라,
    // 그 검색어로 들어온 사람이 기대와 다른 걸 만난다.
    "학과 추천",
    "진로 탐구",
    "나에게 맞는 학과",
    "대학 학과 추천",
    "고등학생 진로",
    "중학생 진로",
    "문과 학과",
    "이과 학과",
    "학과 정보",
    "전공 선택",
    "진로 탐색",
    "선배들이 만든 입시자료",
  ],
  alternates: { canonical: CAREER_URL },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: CAREER_URL,
    siteName: "선배들이 만든 입시자료",
    title: CAREER_TITLE,
    description: CAREER_DESCRIPTION,
  },
};

export default function CareerPage() {
  // useSearchParams를 쓰는 클라이언트 컴포넌트라 Suspense 경계가 필요하다.
  return (
    <Suspense>
      <CareerClient />
    </Suspense>
  );
}
