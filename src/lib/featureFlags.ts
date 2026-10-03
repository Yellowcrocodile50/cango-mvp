/* 기능 스위치 — 배포는 됐지만 아직 열지 않을 기능을 끈다.
   값을 바꾸면 리뷰 게이트를 거쳐 다시 배포해야 반영된다. */

/**
 * 아이디·비밀번호 찾기/재설정 (2026-10-04 사용자: 테스트가 더 필요해 보류).
 * false면 로그인 화면의 찾기 링크가 숨고, /find-id·/find-password·/reset-password 페이지와
 * /api/auth/find-userid·/api/auth/request-password-reset API가 404가 된다.
 * 로컬에서 테스트할 땐 이 값을 잠깐 true로 바꿔 쓰고, 커밋하지 말 것.
 */
export const ACCOUNT_RECOVERY_ENABLED = false;
