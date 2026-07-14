/**
 * 9등급제 내신 값을 5등급제로 근사 환산한다(역방향도 지원).
 *
 * 대학이 공개하는 등급컷은 전부 9등급제 기준인데, 5등급제(2025년 고1부터 적용되는
 * 신제도)로 입력하는 학생도 있어 양방향 환산이 필요하다. 원점수/과목별 데이터가 없어
 * 정확한 환산은 불가능하므로, 실제 25대입 교과전형 등급컷(9등급제)과 이를 재환산한
 * 5등급제 값을 대학별로 나란히 비교한 실측 데이터를 보간표로 사용한다. (출처: 사용자
 * 제공 참고자료 "환산 예시.png" — 25대입 교과전형 70%컷 기준, 상하위 15%·의치한약수·
 * 교과 반영과목이 일부뿐인 대학 제외, 필요한 등급대가 없는 구간은 자료 제공자가 임의
 * 보간한 값 포함)
 * 각 대학의 실제 컷 쌍을 그대로 앵커로 쓰고, 그 사이는 선형보간, 표 범위 밖은 양 끝
 * 구간의 기울기로 외삽한다.
 */

/** [9등급제, 5등급제] 실측 페어. 9등급제 기준 오름차순 정렬. */
const CONVERSION_TABLE: [grade9: number, grade5: number][] = [
  [1.25, 1.04],
  [1.3, 1.06],
  [1.35, 1.07],
  [1.45, 1.1],
  [1.55, 1.13],
  [1.65, 1.16],
  [1.74, 1.19],
  [1.86, 1.2],
  [1.97, 1.23],
  [2.07, 1.3],
  [2.11, 1.39],
  [2.21, 1.43],
  [2.33, 1.55],
  [2.41, 1.56],
  [2.5, 1.7],
  [2.6, 1.72],
  [2.71, 1.79],
  [2.8, 1.82],
  [2.93, 1.84],
  [3.1, 1.96],
  [3.23, 1.98],
  [3.32, 1.99],
  [3.46, 2.08],
  [3.54, 2.17],
  [3.6, 2.2],
  [3.72, 2.215],
  [3.84, 2.21],
  [3.95, 2.33],
  [4.06, 2.37],
  [4.18, 2.4],
  [4.24, 2.45],
  [4.3, 2.5],
  [4.4, 2.5],
  [4.53, 2.6],
  [4.6, 2.67],
  [4.71, 2.65],
  [4.77, 2.77],
  [4.86, 2.8],
  [4.95, 2.85],
  [5.06, 3.01],
  [5.12, 3.05],
  [5.19, 3.08],
  [5.43, 3.23],
];

/** x 오름차순 정렬된 [x, y] 표에서 x에 대응하는 y를 선형보간(범위 밖은 외삽)한다. */
function interpolate(table: [number, number][], x: number): number {
  const first = table[0];
  const last = table[table.length - 1];

  if (x <= first[0]) {
    const [x0, y0] = first;
    const [x1, y1] = table[1];
    return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
  }
  if (x >= last[0]) {
    const [x0, y0] = table[table.length - 2];
    const [x1, y1] = last;
    return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
  }
  let i = 0;
  while (table[i + 1][0] < x) i++;
  const [x0, y0] = table[i];
  const [x1, y1] = table[i + 1];
  return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
}

export function convertGrade9to5(grade9: number): number {
  return Math.min(5, Math.max(1, interpolate(CONVERSION_TABLE, grade9)));
}

const TABLE_5_TO_9: [number, number][] = CONVERSION_TABLE.map(
  ([g9, g5]) => [g5, g9] as [number, number]
).sort((a, b) => a[0] - b[0]);

export function convertGrade5to9(grade5: number): number {
  return Math.min(9, Math.max(1, interpolate(TABLE_5_TO_9, grade5)));
}
