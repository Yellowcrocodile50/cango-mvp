/**
 * 미니 도구(유입용) 레지스트리.
 *
 * 헤더 네비 · 도구 허브(/tools) · sitemap.ts · 도구 간 교차링크가 전부 이 배열 하나를 참조한다.
 * 도구를 추가할 때 건드릴 곳은 여기뿐이고, 나머지는 자동으로 따라온다.
 *
 * ⚠️ `slug`은 색인된 URL이다. 한번 라이브로 나간 슬러그는 바꾸지 않는다.
 *    (/naeshin은 네이버 개별 수집요청까지 제출된 상태라 변경 시 유입이 끊긴다)
 */

export type ToolStatus = "live" | "coming";

export type Tool = {
  /** 최상위 라우트 슬러그. `/${slug}` 로 접근한다. 라이브 후 변경 금지 */
  slug: string;
  /** 헤더·허브에 노출되는 짧은 이름 */
  name: string;
  /** 허브 카드 한 줄 설명 */
  description: string;
  /** 허브 카드 아이콘 */
  emoji: string;
  /**
   * GA 이벤트 접두사. 신규 도구는 `<gaKey>_start` / `_complete` / `_cta_click` / `_share`.
   * 내신 계산기만 예외로 기존 이름(`naeshin_calculate` 등)을 유지한다 — 아래 주석 참고.
   */
  gaKey: string;
  status: ToolStatus;
  /** 헤더에 붙는 작은 배지. 없으면 미표시 */
  badge?: string;
  /** sitemap 우선순위 */
  priority: number;
};

export const tools: Tool[] = [
  {
    slug: "naeshin",
    name: "내신 계산기",
    description: "지금 성적으로 갈 수 있는 대학과, 목표 대학에 필요한 등급을 역산해요.",
    emoji: "🎓",
    gaKey: "naeshin",
    status: "live",
    badge: "v4.0",
    priority: 0.9,
  },
  {
    slug: "career",
    name: "진로 탐구",
    description: "좋아하는 과목과 관심사를 고르면 맞는 학과를 찾아줘요. 성적 없이도 볼 수 있어요.",
    emoji: "🧭",
    gaKey: "career",
    status: "live",
    badge: "NEW",
    priority: 0.8,
  },
];

/** 헤더·사이트맵에 노출할 도구 (준비 중인 것은 제외) */
export const liveTools = tools.filter((t) => t.status === "live");

export function getTool(slug: string): Tool | undefined {
  return tools.find((t) => t.slug === slug);
}

/** 도구 간 교차링크용 — 자기 자신을 뺀 나머지 라이브 도구 */
export function otherLiveTools(currentSlug: string): Tool[] {
  return liveTools.filter((t) => t.slug !== currentSlug);
}

export const TOOLS_HUB_PATH = "/tools";
export const TOOLS_NAV_LABEL = "입시 도구";
