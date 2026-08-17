import {
  departmentsForTrack,
  interestsForTrack,
  type CareerDepartment,
  type Interest,
  type Track,
} from "@/data/careerDepartments";

export type CareerMatch = {
  dept: CareerDepartment;
  /** 실제로 겹친 관심사 (결과 카드에 그대로 보여줘서 "왜 추천됐는지"를 설명한다) */
  matched: Interest[];
  matchCount: number;
};

/**
 * 고른 관심사와 겹치는 학과를 찾는다.
 *
 * 📌 원본(글바치)은 `겹친수 / max(학과키워드수, 고른수)`를 "78% 적합"처럼 퍼센트로 보여줬다.
 * 임의 공식인데 퍼센트로 쓰면 근거 있는 수치처럼 읽혀서 그대로 옮기지 않았다.
 * 대신 **겹친 관심사를 그대로 노출**한다. 계산식이 화면에 드러나므로 오해할 여지가 없고,
 * 사용자에게도 "무엇 때문에 이 학과가 나왔는지"가 바로 보인다.
 *
 * 정렬: 겹친 수가 많은 순 → 같으면 학과가 내건 관심사 대비 많이 맞은 순 → 이름 순.
 * 두 번째 기준이 있어야 keys 3개 중 3개를 맞춘 학과가 keys 5개 중 3개를 맞춘 학과보다 위로 간다.
 */
export function matchDepartments(track: Track, selectedIds: string[]): CareerMatch[] {
  const selected = new Set(selectedIds);
  const byId = new Map(interestsForTrack(track).map((i) => [i.id, i]));

  return departmentsForTrack(track)
    .map((dept) => {
      const matched = dept.keys
        .filter((k) => selected.has(k))
        .map((k) => byId.get(k))
        .filter((i): i is Interest => Boolean(i));
      return { dept, matched, matchCount: matched.length };
    })
    .filter((m) => m.matchCount > 0)
    .sort(
      (a, b) =>
        b.matchCount - a.matchCount ||
        b.matchCount / b.dept.keys.length - a.matchCount / a.dept.keys.length ||
        a.dept.name.localeCompare(b.dept.name)
    );
}

/** 고른 관심사 id를 URL에 넣을 문자열로 (공유 링크용) */
export function encodeInterests(ids: string[]): string {
  return ids.join(",");
}

/** URL 문자열 → 관심사 id 배열. 해당 계열 화면에 없는 id는 버린다 */
export function decodeInterests(raw: string | null, track: Track | undefined): string[] {
  if (!raw || !track) return [];
  const valid = new Set(track.interestIds);
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => valid.has(s));
}
