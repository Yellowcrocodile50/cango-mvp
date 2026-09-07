import type { Metadata } from "next";
import {
  MAX_FLOOR,
  MAX_INTV,
  QUESTIONS,
  STRATEGY_TYPES,
  TIERS,
  TIER_ORDER,
  getType,
} from "@/data/aimingStrategy";
import AimingClient from "./AimingClient";

const AIMING_URL = "https://www.cango.kr/aiming";
// 네이버 검색결과 제목은 40~50자에서 잘리고 사이트명 접미사가 붙으므로 짧게 유지한다.
// 검색어를 노리는 레버는 keywords가 아니라 title이다(2026-09-03 /career 실측).
// 도구 이름("원서 조준 테스트")을 앞에 둔다. 검색결과에서 클릭해 들어온 사람이
// 제목과 첫 화면이 다른 말이면 잘못 들어온 줄 안다.
const AIMING_TITLE = "원서 조준 테스트 — 수시 원서 카드 6장 전략";
// ⚠️ 문항 수·유형 수는 문구에 숫자를 박지 말고 데이터에서 뽑는다.
//    질문이나 유형을 손볼 때마다 조용히 틀린 말이 된다(/career에서 학과 개수로 같은 처리를 했다).
// ⚠️ 유형 이름도 배열에서 뽑는다. 예전에 다섯 개를 문장에 박아뒀다가 이름을 사격 컨셉으로
//    바꾸는 순간 설명만 옛 이름으로 남을 뻔했다.
const TYPE_NAMES = STRATEGY_TYPES.map((t) => t.name).join("·");
// ⚠️ 층위 이름도 배열에서 뽑는다(상향·적정·안정·하향). 3단에서 4단으로 늘릴 때
//    이 문장만 옛 3단으로 남을 뻔했다.
const TIER_NAMES = TIER_ORDER.map((k) => TIERS[k].label).join("·");
const AIMING_DESCRIPTION = `수시 원서 카드 6장 전략 - 질문 ${QUESTIONS.length}개로 내 원서 조준 스타일을 확인해보세요. 6장을 ${TIER_NAMES}으로 몇 장씩 나눌지, 교과·학생부종합·논술을 어떻게 배분할지, 면접이 있는 전형은 어떻게 쓰는 게 나은지 알려드려요. 성적도 가입도 필요 없어요. ${TYPE_NAMES} ${STRATEGY_TYPES.length}가지 중 내 상황에 맞는 것을 찾아보세요.`;

/**
 * 공유 링크(?t=…)로 들어오면 제목·설명을 그 유형으로 바꾼다.
 * 카카오톡으로 결과를 돌릴 때 미리보기가 전부 같은 제목이면 무엇이 공유된 건지 안 보인다.
 *
 * 📌 canonical은 항상 /aiming로 고정한다. 유형별 URL이 각각 색인되면 내용이 대부분 겹치는
 *    얇은 페이지가 유형 수만큼 생긴다.
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const raw = sp.t;
  const type = getType(typeof raw === "string" ? raw : null);

  const title = type ? `${type.emoji} ${type.name} — 수시 원서 6장 전략` : AIMING_TITLE;
  const description = type ? `${type.tagline}. ${type.summary}` : AIMING_DESCRIPTION;

  return {
    title,
    description,
    keywords: [
      "수시 지원 전략",
      "수시 6장",
      "원서 6장",
      "수시 원서 접수",
      "상향 적정 안정 하향",
      "원서 조준 테스트",
      "수시 하향 지원",
      "논술 전형",
      "면접 전형",
      "학생부종합",
      "교과 전형",
      "수능 최저",
      "고3 수시",
      "선배들이 만든 입시자료",
    ],
    alternates: { canonical: AIMING_URL },
    openGraph: {
      type: "website",
      locale: "ko_KR",
      url: type ? `${AIMING_URL}?t=${type.id}&r=1` : AIMING_URL,
      siteName: "선배들이 만든 입시자료",
      title,
      description,
      /* 카카오톡·네이버 공유 미리보기 이미지.
         유형별 가로형(1200x630)을 쓴다 — 결과 링크가 퍼져서 들어오는 유입이 큰 도구라
         미리보기가 전부 같은 그림이면 무엇이 공유된 건지 안 보인다.
         📌 layout.tsx에 metadataBase가 있어서 상대경로가 절대 URL로 펼쳐진다.
         ⚠️ 유형이 없을 때(맨 /aiming) 쓸 기본 이미지는 아직 없다. */
      ...(type && {
        images: [
          {
            url: `/aiming/og/${type.id}.png`,
            width: 1200,
            height: 630,
            alt: `${type.name} — 원서 조준 테스트`,
          },
        ],
      }),
    },
    ...(type && {
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [`/aiming/og/${type.id}.png`],
      },
    }),
  };
}

/* ⚠️ 초기값을 **서버에서** 읽어 props로 내려준다.
   클라이언트에서 useSearchParams로 읽으면 가장 가까운 Suspense 경계까지가 클라이언트
   렌더로 넘어가 정적 HTML에 본문이 안 담긴다(/naeshin에서 실제로 겪은 SEO 회귀). */
export default async function AimingPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const first = (key: string) => {
    const v = sp[key];
    return typeof v === "string" ? v : null;
  };

  /* 배분은 유형만으로 정해지지 않는다. 하향 수용도(f)와 대학별고사 여력(i)이 같이 있어야
     공유받은 사람이 **보낸 사람과 같은 배분**을 본다.
     범위를 벗어난 값은 버린다 — 주소창을 손으로 고쳐도 화면이 깨지지 않아야 한다. */
  const clamp = (raw: string | null, max: number) => {
    if (raw === null) return null;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0 || n > max) return null;
    return n;
  };

  return (
    <AimingClient
      initialType={first("t")}
      initialFloor={clamp(first("f"), MAX_FLOOR)}
      initialIntv={clamp(first("i"), MAX_INTV)}
    />
  );
}
