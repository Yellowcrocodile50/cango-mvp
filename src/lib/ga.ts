declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function trackEvent(
  eventName: string,
  params?: Record<string, string | number | boolean>
) {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", eventName, params);
  }
}

/**
 * 미니 도구 공통 이벤트 이름 규칙: `<gaKey>_<action>`.
 *
 * - start      도구를 실제로 쓰기 시작(첫 입력/첫 선택)
 * - complete   결과를 봄 — 도구별 핵심 지표
 * - cta_click  결과 화면의 자료 CTA 클릭
 * - share      결과 공유
 *
 * ⚠️ 내신 계산기는 이 규칙을 소급 적용하지 않는다. 이미 `naeshin_calculate`로
 * 2만 건 가까이 쌓여 있어서 이름을 바꾸면 리포트가 두 동강 난다.
 * 기존 이름(`naeshin_calculate`, `naeshin_cta_click`, `naeshin_request_submit`)을 그대로 두고,
 * 규칙은 신규 도구부터 적용한다.
 */
export type ToolAction = "start" | "complete" | "cta_click" | "share";

export function trackToolEvent(
  gaKey: string,
  action: ToolAction,
  params?: Record<string, string | number | boolean>
) {
  trackEvent(`${gaKey}_${action}`, params);
}

/**
 * 링크 클릭 출처 계측. 지금까지 헤더 네비·홈 배너 클릭이 계측되지 않아
 * "/naeshin 유입이 배너인지 헤더인지" 구분이 불가능했다(GA `click` 28일 29회뿐).
 *
 * 📌 파라미터를 `target` 하나로 고정한 이유: `target`은 이미 GA4 맞춤 측정기준으로
 * 등록돼 있어 추가 등록 없이 바로 리포트에 분해된다. 출처는 파라미터가 아니라
 * **이벤트 이름**으로 구분한다(nav_click / banner_click / tool_cross_link).
 */
export function trackNavClick(target: string) {
  trackEvent("nav_click", { target });
}

export function trackBannerClick(target: string) {
  trackEvent("banner_click", { target });
}

/** 도구 결과 화면에서 다른 도구로 넘어간 클릭 */
export function trackToolCrossLink(target: string, from: string) {
  trackEvent("tool_cross_link", { target, from });
}
