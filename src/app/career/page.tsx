import type { Metadata } from "next";
import { departments } from "@/data/careerDepartments";
import CareerClient from "./CareerClient";

const CAREER_URL = "https://www.cango.kr/career";
// 네이버 검색결과 제목은 40~50자에서 잘리고 사이트명 접미사가 붙으므로 짧게 유지한다.
// ⚠️ 제목의 "진로 탐구"를 "진로 탐색"으로 바꾸지 말 것(2026-09-03 사용자 결정).
//    네이버 웹검색은 title 토큰을 거의 그대로 매칭한다 — 실측으로 `cango 진로 탐구`는
//    1위인데 `cango 진로 탐색`은 0건이었다. 이름은 사이트 표기인 "진로 탐구"로 간다.
//    같은 실측에서 keywords 메타에는 "진로 탐색"이 이미 있었는데도 0건이었다.
//    → **검색어를 노리는 레버는 keywords가 아니라 title이다.**
const CAREER_TITLE = "진로 탐구 · 학과 추천 — 나에게 맞는 학과 찾기";
// ⚠️ 학과 개수는 문구에 숫자를 박지 말고 반드시 departments.length에서 뽑는다
//    — 데이터가 늘 때마다 조용히 틀린 말이 된다.
const CAREER_DESCRIPTION =
  `무료 학과 추천 - 학과 ${departments.length}개를 모아뒀어요. 좋아하는 과목과 관심사를 고르면 나에게 맞는 대학 학과를 찾아드려요. 성적을 넣지 않아도 되고 가입도 필요 없어서 중학생·고등학생 모두 볼 수 있어요. 의예과·간호학과·컴퓨터공학과부터 경영·심리·교육까지 이과·문과 학과의 소개와 졸업 후 진로, 학과별 등급컷까지 이어서 확인할 수 있습니다.`;

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

/* ⚠️ 초기 선택값을 **서버에서** 읽어 props로 내려준다.
   전엔 클라이언트에서 `useSearchParams`로 읽었는데, 그러면 프리렌더 시
   가장 가까운 Suspense 경계까지가 클라이언트 렌더로 넘어가서(공식 문서 useSearchParams >
   Behavior > Prerendering) **정적 HTML에 본문이 하나도 안 담긴다.**
   유입의 90%가 검색이라 크롤러가 빈 페이지를 보게 되는 문제였다. */
export default async function CareerPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const first = (key: string) => {
    const v = sp[key];
    return typeof v === "string" ? v : null;
  };

  return (
    <CareerClient
      initialTrack={first("track")}
      initialInterests={first("i")}
      initialShowResults={first("r") === "1"}
      /* 로그인하러 나갔다 돌아온 사람이 담으려던 학과. 서버에서 읽는 이유는
         클라이언트에서 읽으면 URL 동기화 effect가 먼저 이 값을 지워버릴 수 있어서다. */
      initialWish={first("wish")}
    />
  );
}
