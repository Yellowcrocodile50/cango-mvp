/**
 * 진로 탐구(/career) 데이터.
 *
 * 관심사를 고르면 겹치는 학과를 찾아준다. 성적을 쓰지 않으므로 중학생도 쓸 수 있다.
 *
 * ── 설계 원칙 ──────────────────────────────────────────────
 * ① **내신 계산기의 26개 학과는 전부 들어간다.** 두 도구를 잇는 게 이 기능의 핵심 가치라,
 *    계산기에 있는 학과가 여기 없으면 통로가 끊긴다.
 * ② **`keys`는 "관련 있는 과목"이 아니라 "그 학과를 구별하는 관심사"만 적는다.**
 *    초기 버전은 이과 12개 학과 중 11개에 '수학'이 붙어 있었다. 사실이긴 해도 정보량이 0이라
 *    수학만 골라도 전 학과가 나왔다. 그래서 수학은 **수학이 정체성인 학과에만** 붙인다.
 *    새 학과를 추가할 때도 이 원칙을 지킬 것 — keys는 3~5개가 적당하다.
 * ③ **한 학과가 두 계열에 속할 수 있다**(`tracks`). 심리학과·통계학과처럼 문/이과로 딱 나뉘지
 *    않는 학과가 실제로 많다. 한쪽에만 두면 반대편 학생은 그 학과를 영영 못 만난다.
 *
 * ── 검수 이력 ──────────────────────────────────────────────
 * 2026-08-16, 50개 전수를 커리어넷·국가법령정보센터·국시원·큐넷·대학 공식 페이지와 대조했다
 * (외부 LLM에 조회를 맡기고, 인용 도메인이 공식인지와 구조 변경 건은 직접 확인).
 *   - 이상 없음 27 / 수정필요 23 / 확인 불가 0
 *   - 수정필요 23건 중 **21건이 "졸업 = 자격 취득"으로 읽히는 표현** → `license` 필드 신설로 처리
 *   - 나머지: 건축계열(5년제 단정), 음악학과(클래식 단정), 사회·윤리교육과(역사 포함) 서술 교정
 * 화면에도 "일반적인 설명이라 참고용"임을 계속 밝힌다. 학과를 추가하면 같은 기준으로 검수할 것.
 */

import type { NaeshinDepartment } from "./naeshinCutoffs";

export type TrackId = "science" | "humanities" | "arts";

export type Interest = {
  id: string;
  label: string;
};

export type CareerDepartment = {
  name: string;
  emoji: string;
  /**
   * 이 학과가 나타나는 **화면**. 둘 다 넣으면 양쪽에 모두 나온다.
   *
   * ⚠️ 커리어넷의 7계열 분류(인문/사회/교육/공학/자연/의약/예체능)가 **아니다.**
   * 첫 화면에서 "이과/문과" 둘 중 무엇을 고른 학생에게 보여줄지를 정하는 UI 값이다.
   * 2026-08-16 외부 검수가 "미술학과·초등교육과를 문과로 분류한 건 틀렸다(예체능계열/교육계열이다)"고
   * 12건을 지적했으나 **전부 반려**했다 — 분류 체계가 다르고, 예체능·교대 지망생은 실제로
   * 문과 화면에서 찾는다. 검수 파일에 이 필드를 "계열"로만 표기해 생긴 오해다.
   */
  tracks: TrackId[];
  /** 이 학과를 구별하는 관심사 id (관련 있는 모든 과목이 아니라 대표 3~5개) */
  keys: string[];
  desc: string;
  jobs: string[];
  fit: string[];
  tags: string[];
  /**
   * 졸업만으로는 그 일을 할 수 없을 때의 조건 안내(국가시험·면허·교직과정·자격시험 등).
   *
   * 📌 진로 항목마다 "(면허 필요)"를 붙이지 않고 학과당 한 줄로 모은다.
   * 의료 계열은 진로 4~5개에 전부 붙어서 카드가 괄호투성이가 되고, 중학생이 읽기 어려워진다.
   * 조건은 상세를 펼쳤을 때 한 번만 보여준다.
   *
   * ⚠️ 2026-08-16 커리어넷·국가법령정보센터·국시원·큐넷 대조로 확인한 23건에서 나온 필드다.
   * 50개 중 21개가 "졸업 = 자격 취득"으로 읽히는 문제였다. 학과를 추가할 때 이 항목을 꼭 확인할 것.
   */
  license?: string;
  /**
   * 내신 계산기에 있는 대응 학과. 있으면 결과 카드에서 등급컷으로 넘어갈 수 있다.
   * ⚠️ 이름이 정확히 같지 않은 경우에도 링크 문구에는 **넘어갈 학과 이름을 그대로** 노출한다.
   */
  naeshinDept?: NaeshinDepartment;
};

/* ── 관심사 공용 풀 ──
   계열별로 따로 두지 않는 이유: 교차 학과(심리·통계·식품영양·산업공학)의 keys가
   양쪽 계열에서 모두 해석돼야 하기 때문이다. 어느 계열 화면에 띄울지는 TRACKS가 정한다. */
/* ⚠️ label을 고칠 때 지켜야 하는 것 (2026-08-17)
   ① **9자 이내.** 칩은 모바일 한 화면에 다 보여야 탐색이 된다(390px에서 26개 기준).
      길어지면 한 줄에 하나씩 놓여 화면 하나를 넘긴다.
   ② **학과 이름의 앞부분을 잘라 쓰지 말 것.** `정보·자료정리`(문헌정보) `정치·사회제도`(정치외교)
      처럼 쓰면, 학과를 모르는 학생을 위한 도구인데 답을 알아야 답할 수 있는 입력이 된다.
      → 학생이 자기 말로 할 법한 표현으로 쓴다("사회 규칙 정하기").
   ③ id는 절대 바꾸지 말 것 — 공유 링크(`?i=`)와 학과 `keys`가 전부 id를 쓴다.
      label은 화면 표시 전용이라 바꿔도 매칭 결과가 달라지지 않는다. */
export const interests: Interest[] = [
  // 자연·공학 쪽
  { id: "math", label: "수학 문제 풀기" },
  { id: "physics", label: "힘과 움직임" },
  { id: "chem", label: "실험·물질 변화" },
  { id: "bio", label: "유전자·생명" },
  { id: "body", label: "몸과 건강" },
  { id: "earth", label: "지구와 날씨" },
  { id: "cs", label: "컴퓨터·코딩" },
  { id: "ai", label: "로봇·AI" },
  { id: "data", label: "숫자로 흐름 읽기" },
  { id: "game", label: "게임하기" },
  { id: "machine", label: "기계·자동차" },
  { id: "space", label: "우주와 비행" },
  { id: "material", label: "배터리·반도체" },
  { id: "build", label: "건물과 공간" },
  { id: "env", label: "환경·기후 문제" },
  { id: "food", label: "음식과 영양" },
  { id: "cure", label: "아픈 사람 돕기" },
  { id: "animal", label: "동물 키우기" },
  // 인문·사회 쪽
  { id: "korean", label: "책 읽기" },
  { id: "english", label: "영어·외국어" },
  { id: "history", label: "역사" },
  { id: "philosophy", label: "옳고 그름 따지기" },
  { id: "economy", label: "주식·돈 흐름" },
  { id: "business", label: "창업·장사" },
  { id: "law", label: "법·재판" },
  { id: "politics", label: "뉴스·사회 문제" },
  { id: "psych", label: "사람 마음 읽기" },
  { id: "media", label: "유튜브·영상 보기" },
  { id: "write", label: "글쓰기·웹소설" },
  { id: "art", label: "그림·디자인" },
  { id: "music", label: "음악·노래" },
  { id: "sports", label: "운동·스포츠" },
  { id: "volunteer", label: "어려운 이웃 돕기" },
  { id: "teach", label: "배운 걸 알려주기" },
  { id: "travel", label: "여행·다른 나라" },
  { id: "info", label: "검색·자료 정리" },
  { id: "child", label: "아이·청소년" },
  // 2026-08-16 확충분 — 예체능·조리·농생명·치안 계열을 걸어줄 고리가 없어서 추가했다
  { id: "act", label: "연기·무대" },
  { id: "cook", label: "요리·베이킹" },
  { id: "safety", label: "경찰·소방·보안" },
  { id: "fashion", label: "옷·패션" },
  { id: "plant", label: "식물 키우기" },
];

export type Track = {
  id: TrackId;
  label: string;
  emoji: string;
  keywords: string;
  /** 이 계열 화면에 띄울 관심사. 교차 학과 때문에 양쪽에 겹쳐 나오는 항목이 있다 */
  interestIds: string[];
};

export const TRACKS: Track[] = [
  {
    id: "science",
    label: "이과 · 자연계",
    emoji: "🔬",
    keywords: "수학 · 과학 · 기술 · 의학 · 공학",
    interestIds: [
      "math", "physics", "chem", "bio", "body", "earth",
      "cs", "ai", "data", "game", "machine", "space",
      "material", "build", "env", "food", "cure", "animal",
      "plant", "cook", "safety",
      // 교차 학과용 — 심리학과·산업공학과가 이과 화면에서도 잡히게
      "psych", "business",
      // 수학교육과·과학교육과가 이과 화면에서 '가르치기'로도 잡히게
      "teach",
    ],
  },
  {
    id: "humanities",
    label: "문과 · 인문계",
    emoji: "📖",
    keywords: "언어 · 사회 · 경제 · 법 · 교육",
    interestIds: [
      "korean", "english", "history", "philosophy",
      "economy", "business", "law", "politics",
      "psych", "media", "write", "art", "music",
      "sports", "volunteer", "teach", "travel", "info", "child",
      "safety", "cook",
      // 교차 학과용 — 통계학과·식품영양학과가 문과 화면에서도 잡히게
      "data", "food",
      // 문과에 있는 공간·지리·건강 계열 학과가 한 관심사로만 걸리지 않게
      // (실내건축·산업디자인·부동산 / 지리학·지리교육 / 식품영양·체육)
      "build", "earth", "body",
    ],
  },
  {
    /* 예체능을 별도 화면으로 뺐다. 미술·음악·무용·연극영화 지망생이 "문과 · 인문계"를 골라야
       자기 학과가 나오는 구조였는데, 그 학생들에겐 둘 다 자기 자리가 아니다.
       미술교육·음악교육·체육 계열은 교육/스포츠 성격도 있어 문과 화면에도 함께 남긴다. */
    id: "arts",
    label: "예체능",
    emoji: "🎨",
    keywords: "미술 · 음악 · 무용 · 연기 · 디자인 · 체육",
    interestIds: [
      "art", "music", "act", "fashion", "media", "write",
      "game", "build", "sports", "body", "teach", "history", "philosophy",
    ],
  },
];

export const TRACK_LABELS: Record<TrackId, string> = {
  science: "이과 · 자연계",
  humanities: "문과 · 인문계",
  arts: "예체능",
};

// 실제 데이터는 저장소에 포함하지 않는다 (./careerDepartments.data — .gitignore 대상).
// 스키마와 판정 기준만 여기 남기고, 수집·검수한 값 자체는 분리했다.
import { departments } from "./careerDepartments.data";
export { departments };

export function getTrack(id: string | null | undefined): Track | undefined {
  return TRACKS.find((t) => t.id === id);
}

/** 해당 계열 화면에 띄울 관심사 (선언 순서를 유지해 화면 배치가 흔들리지 않게 한다) */
export function interestsForTrack(track: Track): Interest[] {
  const shown = new Set(track.interestIds);
  return interests.filter((i) => shown.has(i.id));
}

/** 해당 계열에 속한 학과 (양쪽 계열 학과는 두 곳 모두에서 나온다) */
export function departmentsForTrack(track: Track): CareerDepartment[] {
  return departments.filter((d) => d.tracks.includes(track.id));
}
