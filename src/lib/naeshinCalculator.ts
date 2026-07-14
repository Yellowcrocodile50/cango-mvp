import { convertGrade9to5, convertGrade5to9 } from "@/lib/gradeConversion";
import { getRepresentativeGrade, type DeptCutoff } from "@/data/naeshinCutoffs";

/** 수시 반영 학기: 1-1, 1-2, 2-1, 2-2, 3-1 (3-2는 성적표 미제공으로 반영 안 함) */
export const NAESHIN_TOTAL_SEMESTERS = 5;

export type GradeSystem = "5" | "9";

export type NaeshinVerdict = "impossible" | "safe" | "achievable" | "no_data";

export type NaeshinResult = {
  verdict: NaeshinVerdict;
  /** 학생이 입력한 등급제 */
  gradeSystem: GradeSystem;
  /** 남은 학기 동안 맞아야 하는 평균 등급(입력한 등급제 기준). achievable일 때만 존재 */
  requiredAvg: number | null;
  /** requiredAvg를 반대쪽 등급제로 환산한 참고값. achievable일 때만 존재 */
  requiredAvgConverted: number | null;
  /** 목표 학과 컷을 입력한 등급제로 환산한 값 */
  cutoff: number;
  /** 목표 학과 컷의 9등급제 원본값 */
  cutoff9: number;
  /** 목표 학과 컷의 5등급제 환산값 */
  cutoff5: number;
  /**
   * achievable이면서 지금까지 입력한 학기 평균이 이미 컷보다 좋은(낮은) 경우 true.
   * 이 경우 requiredAvg는 "필요한 최소치"가 아니라 "이 정도까지는 여유가 있다"는 의미로 읽어야 한다.
   */
  aheadOfPace: boolean;
  enteredCount: number;
  remainingCount: number;
};

/**
 * 입력한 학기 성적과 목표 학과의 9등급제 컷으로 남은 학기 필요 평균을 역산한다.
 * gradeSystem이 "9"면 원본 9등급제 컷과 직접 비교(환산 오차 없음), "5"면 컷을 5등급제로
 * 환산한 뒤 비교한다.
 */
export function calculateNaeshinResult(
  enteredGrades: number[],
  cutoff9: number,
  gradeSystem: GradeSystem
): NaeshinResult {
  const scaleMax = gradeSystem === "9" ? 9 : 5;
  const cutoff = gradeSystem === "9" ? cutoff9 : convertGrade9to5(cutoff9);
  const cutoff5 = Math.round(convertGrade9to5(cutoff9) * 100) / 100;
  const convertToOtherSystem = gradeSystem === "9" ? convertGrade9to5 : convertGrade5to9;

  const enteredCount = enteredGrades.length;
  const remainingCount = NAESHIN_TOTAL_SEMESTERS - enteredCount;
  const enteredSum = enteredGrades.reduce((sum, g) => sum + g, 0);
  const enteredAvg = enteredCount > 0 ? enteredSum / enteredCount : 0;

  // 모든 분기가 공유하는 필드. verdict/requiredAvg 등만 분기별로 덮어쓴다.
  const base: NaeshinResult = {
    verdict: "no_data",
    gradeSystem,
    requiredAvg: null,
    requiredAvgConverted: null,
    cutoff,
    cutoff9,
    cutoff5,
    aheadOfPace: false,
    enteredCount,
    remainingCount,
  };

  if (remainingCount <= 0) {
    const currentAvg = enteredSum / NAESHIN_TOTAL_SEMESTERS;
    return { ...base, verdict: currentAvg <= cutoff ? "safe" : "impossible" };
  }

  const requiredAvg = (cutoff * NAESHIN_TOTAL_SEMESTERS - enteredSum) / remainingCount;

  if (requiredAvg < 1) {
    return { ...base, verdict: "impossible" };
  }
  if (requiredAvg > scaleMax) {
    return { ...base, verdict: "safe" };
  }

  const rounded = Math.round(requiredAvg * 100) / 100;
  return {
    ...base,
    verdict: "achievable",
    requiredAvg: rounded,
    requiredAvgConverted: Math.round(convertToOtherSystem(rounded) * 100) / 100,
    aheadOfPace: enteredAvg <= cutoff,
  };
}

/** DeptCutoff 상태를 반영해 계산한다. 등급 데이터가 없는 학과/전형이면 no_data를 반환. */
export function calculateNaeshinResultFromCutoff(
  enteredGrades: number[],
  cutoff: DeptCutoff,
  gradeSystem: GradeSystem
): NaeshinResult {
  const cutoff9 = getRepresentativeGrade(cutoff);
  if (cutoff9 === null) {
    return {
      verdict: "no_data",
      gradeSystem,
      requiredAvg: null,
      requiredAvgConverted: null,
      cutoff: NaN,
      cutoff9: NaN,
      cutoff5: NaN,
      aheadOfPace: false,
      enteredCount: enteredGrades.length,
      remainingCount: NAESHIN_TOTAL_SEMESTERS - enteredGrades.length,
    };
  }
  return calculateNaeshinResult(enteredGrades, cutoff9, gradeSystem);
}
