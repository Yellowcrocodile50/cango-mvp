/**
 * 내신 계산기용 대학×학과 학생부교과전형 등급컷 원자료 (9등급제 기준).
 *
 * 출처/신뢰도 요약:
 * - confidence "official": 대학 입학처 공식 PDF/Excel 원자료
 * - confidence "secondary": 입시 블로그/컨설팅업체 등 2차 가공 자료
 * - confidence "low": 출처가 불명확하거나 서로 다른 자료가 상충하는 추정치
 *
 * status 값 설명 (등급 데이터가 없는 경우의 사유 구분):
 * - "no_department": 해당 대학에 그 학과(단과대) 자체가 없음
 * - "no_quant_track": 학과는 있으나 학생부종합전형(학종)으로만 선발 — 순수 교과전형 없음
 * - "merged_no_data": 학부/자유전공 등으로 통합모집이라 개별 학과 컷이 공개되지 않음
 * - "no_data": 조사 시점에 확인하지 못함(자료 존재 여부와 무관하게 미확보)
 *
 * 연도는 대학별로 2025학년도 또는 2026학년도가 섞여 있다(2026학년도 재조사가
 * 세션 한도로 일부만 끝났기 때문). 각 항목의 `year` 필드로 구분한다.
 */

export const NAESHIN_DEPARTMENTS = [
  "의예과",
  "치의예과",
  "한의예과",
  "약학과",
  "수의예과",
  "컴퓨터공학과",
  "전자전기공학과",
  "기계공학과",
  "화학과",
  "생명과학과",
  "경영학과",
  "국어국문학과",
  "영어영문학과",
  "중어중문학과",
  // v2.0 문과 확충 (2026-08-02)
  "미디어커뮤니케이션학과",
  "정치외교학과",
  "법학과",
  "교육학과",
  "국어교육과",
  "영어교육과",
  "사회·윤리교육과",
  // v3.0 보건 확충 (2026-08-11)
  "간호학과",
  "보건계열",
  // v3.1 건축·심리 확충 (2026-08-11)
  "건축계열",
  "심리학과",
  // v3.5 행정 확충 (2026-08-13)
  "행정학과",
  // v3.6 일어일문 확충 (2026-08-19)
  "일어일문학과",
  // v4.0 이공계 확충 (2026-08-21)
  "화학공학과",
  "생명공학과",
  "신소재공학과",
  "수학과",
  "물리학과",
  "통계학과",
] as const;

export type NaeshinDepartment = (typeof NAESHIN_DEPARTMENTS)[number];

/** 한 학과 분류에 여러 모집단위가 걸쳐있을 때 주 자료 외에 별도 카드로 같이 보여줄 항목 */
export type AltCutoff = {
  /** 결과 카드에 "대학명(이 이름)"으로 표시. 모집단위명이 CANGO 학과 분류와 같고 branchCampus 배지만으로 구분되면 생략 가능 */
  actualName?: string;
  avg?: number;
  cut50?: number;
  cut70?: number;
  cut80?: number;
  admissionType?: "comprehensive";
  admissionName?: string;
  mergedUnit?: boolean;
  /** 본교가 아닌 분교/제2캠퍼스 소속일 때 캠퍼스 배지 문구(예: "미래캠", "성의교정 서초") — 문구 그대로 렌더링된다 */
  branchCampus?: string;
  /** 결과 카드에 노출되는 짧은 안내(지원자격 제한 등) */
  notice?: string;
  /** 내부 문서용 메모(전형명·모집인원·출처). 사용자에게 렌더링되지 않는다 */
  note?: string;
};

type CutoffAvailable = {
  status: "data";
  year: 2025 | 2026;
  confidence: "official" | "secondary" | "low";
  /** 최종등록자 평균등급 */
  avg?: number;
  /** 50%컷(등록자 상위 50% 커트라인) */
  cut50?: number;
  /** 70%컷 */
  cut70?: number;
  /** 80%컷 (경상국립대처럼 70%컷 대신 80%컷만 공개하는 경우) */
  cut80?: number;
  /** 그 대학에서 이 CANGO 학과 분류에 대응하는 실제 모집단위명이 다를 때(예: "첨단컴퓨팅학부") — 결과 카드에 "대학명(실제명)"으로 표시 */
  actualName?: string;
  /** 학생부교과전형이 아예 없어서 학생부종합전형 수치를 대신 쓴 경우 — 결과 카드에 주황 점으로 구분 표시. note에 전형명을 반드시 명시할 것 */
  admissionType?: "comprehensive";
  /** 배지에 함께 노출할 전형명(예: "일반전형", "면접형"). 어느 전형 수치인지 카드에서 바로 보이게 함 */
  admissionName?: string;
  /** 개별 학과 컷이 아니라 계열/학부 통합모집 수치를 쓴 경우 — 결과 카드에 "계열모집" 배지로 구분 표시. actualName에 통합 단위명을 넣을 것 */
  mergedUnit?: boolean;
  /** 본교가 아닌 분교/제2캠퍼스 소속일 때 캠퍼스명(예: "글로컬", "WISE", "천안") — 결과 카드에 "○○캠" 배지로 표시. 본교와 입지·모집이 완전히 다르므로 반드시 표기할 것 */
  branchCampus?: string;
  /** 같은 CANGO 학과 분류에 걸쳐있는 다른 모집단위들 — 각각 별도 결과 카드로 표시됨 */
  alt?: AltCutoff[];
  /** 결과 카드에 노출되는 짧은 안내(지원자격 제한 등) */
  notice?: string;
  /** 내부 문서용 메모(전형명·모집인원·출처). status가 "data"일 땐 렌더링되지 않는다 */
  note?: string;
};

type CutoffUnavailable = {
  status: "no_department" | "no_quant_track" | "merged_no_data" | "no_data";
  note?: string;
};

export type DeptCutoff = CutoffAvailable | CutoffUnavailable;

export type UniversityCutoffs = {
  tier: string;
  university: string;
  /** 대학 전체가 계산 대상에서 제외되는 경우의 사유 (예: 서울대, 한국외대, 서울시립대) */
  excludedReason?: string;
  departments: Partial<Record<NaeshinDepartment, DeptCutoff>>;
};

// 실제 데이터는 저장소에 포함하지 않는다 (./naeshinCutoffs.data — .gitignore 대상).
// 스키마와 판정 기준만 여기 남기고, 수집·검수한 값 자체는 분리했다.
import { naeshinCutoffs } from "./naeshinCutoffs.data";
export { naeshinCutoffs };

/**
 * 등급 지표 중 하나를 대표값으로 뽑아 쓸 때 쓰는 우선순위: 50%컷 > 평균 > 70%컷 > 80%컷.
 * 안전 마진을 최대한 보수적으로 잡기 위해 70%컷(등록자 하위 30%까지 포함하는 느슨한 기준)보다
 * 50%컷(중앙값, 더 깐깐한 기준)을 우선한다 — "된다고 했다가 안 되는" 리스크가
 * "안 된다고 했다가 되는" 리스크보다 훨씬 크기 때문.
 */
export function getRepresentativeGrade(cutoff: DeptCutoff): number | null {
  if (cutoff.status !== "data") return null;
  return cutoff.cut50 ?? cutoff.avg ?? cutoff.cut70 ?? cutoff.cut80 ?? null;
}
